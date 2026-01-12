import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { UserScore, ScorePeriod, ScoreGrade } from '../../../entities/user-score.entity';
import { Attendance, AttendanceStatus } from '../../../entities/attendance.entity';
import { LeaveRequest, LeaveRequestStatus } from '../../../entities/leave-request.entity';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';
import { PerformanceMonitoringService } from '../../../core/monitoring/performance-monitoring.service';

interface ScoreComponents {
  attendanceScore: number;
  punctualityScore: number;
  reliabilityScore: number;
}

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(UserScore)
    private scoreRepo: Repository<UserScore>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(LeaveRequest)
    private leaveRequestRepo: Repository<LeaveRequest>,
    private dataSource: DataSource,
    private cacheService: RedisCacheService,
    private perfMonitor: PerformanceMonitoringService,
  ) {}

  /**
   * Calculate and save monthly score for a user
   */
  async calculateMonthlyScore(
    userId: number,
    year: number,
    month: number,
  ): Promise<UserScore> {
    const startTime = Date.now();

    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Get attendance records for the month
      const attendances = await this.attendanceRepo.find({
        where: {
          userid: userId,
          attendancedate: Between(startDate, endDate),
        },
        relations: ['shift'],
      });

      // Get leave requests for the month
      const leaves = await this.leaveRequestRepo.find({
        where: {
          userid: userId,
          status: LeaveRequestStatus.APPROVED,
        },
      });

      // Calculate score components
      const scores = this.calculateScoreComponents(
        attendances,
        leaves,
        startDate,
        endDate,
      );

      // Calculate total score (weighted average)
      const totalScore =
        scores.attendanceScore * 0.5 + // 50% weight
        scores.punctualityScore * 0.35 + // 35% weight
        scores.reliabilityScore * 0.15; // 15% weight

      // Determine grade
      const grade = this.calculateGrade(totalScore);

      // Create score details
      const scoreDetails = {
        totalWorkingDays: this.getWorkingDays(startDate, endDate),
        totalAttendances: attendances.length,
        presentDays: attendances.filter(a => a.status === AttendanceStatus.PRESENT)
          .length,
        absentDays: attendances.filter(a => a.status === AttendanceStatus.ABSENT)
          .length,
        lateDays: attendances.filter(a => this.isLate(a)).length,
        approvedLeaves: leaves.length,
        components: scores,
      };

      // Save or update score
      const scoreDate = new Date(year, month - 1, 1);
      let userScore = await this.scoreRepo.findOne({
        where: {
          userid: userId,
          scoredate: scoreDate,
          scoreperiod: ScorePeriod.MONTHLY,
        },
      });

      if (userScore) {
        Object.assign(userScore, {
          attendancescore: scores.attendanceScore,
          punctualityscore: scores.punctualityScore,
          reliabilityscore: scores.reliabilityScore,
          totalscore: totalScore,
          grade,
          scoredetails: scoreDetails,
        });
      } else {
        userScore = this.scoreRepo.create({
          userid: userId,
          scoredate: scoreDate,
          scoreperiod: ScorePeriod.MONTHLY,
          attendancescore: scores.attendanceScore,
          punctualityscore: scores.punctualityScore,
          reliabilityscore: scores.reliabilityScore,
          totalscore: totalScore,
          grade,
          scoredetails: scoreDetails,
        });
      }

      const saved = await this.scoreRepo.save(userScore);

      // Invalidate cache
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.USER_SCORE_MONTHLY(userId, year, month),
      );
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.LEADERBOARD_CURRENT_MONTH(),
      );

      // Refresh materialized view
      await this.dataSource.query('SELECT refresh_hr_materialized_views()');

      return saved;
    } finally {
      await this.perfMonitor.logQueryPerformance(
        'scoring.calculateMonthly',
        Date.now() - startTime,
      );
    }
  }

  /**
   * Calculate individual score components
   */
  private calculateScoreComponents(
    attendances: Attendance[],
    leaves: LeaveRequest[],
    startDate: Date,
    endDate: Date,
  ): ScoreComponents {
    const workingDays = this.getWorkingDays(startDate, endDate);

    // Attendance Score (50% weight)
    // Measures presence vs absence
    const presentDays = attendances.filter(
      a =>
        a.status === AttendanceStatus.PRESENT ||
        a.status === AttendanceStatus.REMOTE_WORK ||
        a.status === AttendanceStatus.BUSINESS_TRAVEL,
    ).length;

    const onLeaveDays = attendances.filter(
      a => a.status === AttendanceStatus.ON_LEAVE,
    ).length;

    const attendanceRate =
      workingDays > 0 ? (presentDays + onLeaveDays) / workingDays : 1;
    const attendanceScore = Math.min(100, attendanceRate * 100);

    // Punctuality Score (35% weight)
    // Measures on-time clock-ins
    const clockedInDays = attendances.filter(a => a.clockintime).length;
    const lateDays = attendances.filter(a => this.isLate(a)).length;

    const punctualityRate =
      clockedInDays > 0 ? (clockedInDays - lateDays) / clockedInDays : 1;
    const punctualityScore = Math.min(100, punctualityRate * 100);

    // Reliability Score (15% weight)
    // Measures consistency (no unplanned absences)
    const unplannedAbsences = attendances.filter(
      a => a.status === AttendanceStatus.ABSENT,
    ).length;

    const reliabilityRate =
      workingDays > 0 ? (workingDays - unplannedAbsences) / workingDays : 1;
    const reliabilityScore = Math.min(100, reliabilityRate * 100);

    return {
      attendanceScore: Math.round(attendanceScore * 100) / 100,
      punctualityScore: Math.round(punctualityScore * 100) / 100,
      reliabilityScore: Math.round(reliabilityScore * 100) / 100,
    };
  }

  /**
   * Calculate grade based on total score
   */
  private calculateGrade(score: number): ScoreGrade {
    if (score >= 95) return ScoreGrade.A_PLUS;
    if (score >= 90) return ScoreGrade.A;
    if (score >= 85) return ScoreGrade.B_PLUS;
    if (score >= 80) return ScoreGrade.B;
    if (score >= 70) return ScoreGrade.C;
    if (score >= 60) return ScoreGrade.D;
    return ScoreGrade.F;
  }

  /**
   * Check if attendance is late
   */
  private isLate(attendance: Attendance): boolean {
    if (!attendance.clockintime || !attendance.shift?.starttime) {
      return false;
    }

    const clockInTime = new Date(attendance.clockintime);
    const clockInHour = clockInTime.getHours();
    const clockInMin = clockInTime.getMinutes();
    const [shiftHour, shiftMin] = attendance.shift.starttime.split(':').map(Number);

    const clockInMinutes = clockInHour * 60 + clockInMin;
    const shiftMinutes = shiftHour * 60 + shiftMin;

    // Consider late if more than 15 minutes after shift start
    return clockInMinutes > shiftMinutes + 15;
  }

  /**
   * Get number of working days (excluding weekends)
   */
  private getWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday or Saturday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Get user score for a specific month
   */
  async getUserMonthlyScore(
    userId: number,
    year: number,
    month: number,
  ): Promise<UserScore | null> {
    const cacheKey = this.cacheService.CACHE_KEYS.USER_SCORE_MONTHLY(
      userId,
      year,
      month,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const scoreDate = new Date(year, month - 1, 1);
        return this.scoreRepo.findOne({
          where: {
            userid: userId,
            scoredate: scoreDate,
            scoreperiod: ScorePeriod.MONTHLY,
          },
        });
      },
      this.cacheService.TTL.MEDIUM,
    );
  }

  /**
   * Get current month leaderboard
   */
  async getCurrentMonthLeaderboard(limit: number = 50): Promise<any[]> {
    const cacheKey = this.cacheService.CACHE_KEYS.LEADERBOARD_CURRENT_MONTH();

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.dataSource.query(
          `SELECT * FROM mv_current_month_leaderboard LIMIT $1`,
          [limit],
        );
      },
      this.cacheService.TTL.SHORT,
    );
  }

  /**
   * Get all users' scores for a specific month
   */
  async getMonthlyScores(year: number, month: number): Promise<UserScore[]> {
    const scoreDate = new Date(year, month - 1, 1);

    return this.scoreRepo.find({
      where: {
        scoredate: scoreDate,
        scoreperiod: ScorePeriod.MONTHLY,
      },
      relations: ['user'],
      order: {
        totalscore: 'DESC',
      },
    });
  }

  /**
   * Batch calculate scores for all users
   */
  async batchCalculateMonthlyScores(year: number, month: number): Promise<void> {
    const startTime = Date.now();

    try {
      // Get all active users
      const users = await this.dataSource.query(
        `SELECT id FROM app_user WHERE active = true AND archive = false`,
      );

      const promises = users.map((user: any) =>
        this.calculateMonthlyScore(user.id, year, month),
      );

      await Promise.all(promises);

      await this.perfMonitor.logSystemMetric(
        'batch_scoring_users',
        users.length,
        'scoring.batchCalculate',
      );
    } finally {
      await this.perfMonitor.logQueryPerformance(
        'scoring.batchCalculate',
        Date.now() - startTime,
      );
    }
  }
}
