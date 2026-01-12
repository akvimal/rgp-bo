import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { Attendance, AttendanceStatus } from '../../../entities/attendance.entity';
import { LeaveRequest, LeaveRequestStatus } from '../../../entities/leave-request.entity';
import { UserScore, ScorePeriod } from '../../../entities/user-score.entity';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';
import { PerformanceMonitoringService } from '../../../core/monitoring/performance-monitoring.service';

export interface AttendanceReport {
  userId: number;
  userName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  remoteDays: number;
  lateDays: number;
  attendanceRate: number;
  punctualityRate: number;
}

export interface LeaveReport {
  userId: number;
  userName: string;
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  pendingRequests: number;
  totalDaysTaken: number;
  byLeaveType: Record<string, number>;
}

export interface PerformanceReport {
  userId: number;
  userName: string;
  totalScore: number;
  grade: string;
  attendanceScore: number;
  punctualityScore: number;
  reliabilityScore: number;
  rank: number;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(LeaveRequest)
    private leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(UserScore)
    private scoreRepo: Repository<UserScore>,
    private dataSource: DataSource,
    private cacheService: RedisCacheService,
    private perfMonitor: PerformanceMonitoringService,
  ) {}

  /**
   * Generate comprehensive attendance report for store
   */
  async generateAttendanceReport(
    storeId: number,
    year: number,
    month: number,
  ): Promise<AttendanceReport[]> {
    const cacheKey = this.cacheService.CACHE_KEYS.ATTENDANCE_REPORT(
      storeId,
      year,
      month,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();

        try {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);

          // Get all users in the store
          const users = await this.dataSource.query(
            `SELECT u.id, u.full_name
             FROM app_user u
             WHERE u.location = (SELECT location FROM stores WHERE id = $1)
             AND u.active = true AND u.archive = false`,
            [storeId],
          );

          const reports: AttendanceReport[] = [];

          for (const user of users) {
            const attendances = await this.attendanceRepo.find({
              where: {
                userid: user.id,
                attendancedate: Between(startDate, endDate),
              },
              relations: ['shift'],
            });

            const totalDays = this.getWorkingDays(startDate, endDate);
            const presentDays = attendances.filter(
              a => a.status === AttendanceStatus.PRESENT,
            ).length;
            const absentDays = attendances.filter(
              a => a.status === AttendanceStatus.ABSENT,
            ).length;
            const halfDays = attendances.filter(
              a => a.status === AttendanceStatus.HALF_DAY,
            ).length;
            const leaveDays = attendances.filter(
              a => a.status === AttendanceStatus.ON_LEAVE,
            ).length;
            const remoteDays = attendances.filter(
              a => a.status === AttendanceStatus.REMOTE_WORK,
            ).length;
            const lateDays = attendances.filter(a => this.isLate(a)).length;

            reports.push({
              userId: user.id,
              userName: user.full_name,
              totalDays,
              presentDays,
              absentDays,
              halfDays,
              leaveDays,
              remoteDays,
              lateDays,
              attendanceRate:
                totalDays > 0
                  ? Math.round(((presentDays + leaveDays) / totalDays) * 100)
                  : 0,
              punctualityRate:
                presentDays > 0
                  ? Math.round(((presentDays - lateDays) / presentDays) * 100)
                  : 0,
            });
          }

          return reports;
        } finally {
          await this.perfMonitor.logQueryPerformance(
            'reporting.attendanceReport',
            Date.now() - startTime,
          );
        }
      },
      this.cacheService.TTL.LONG,
    );
  }

  /**
   * Generate leave report for store
   */
  async generateLeaveReport(
    storeId: number,
    year: number,
  ): Promise<LeaveReport[]> {
    const startTime = Date.now();

    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      // Get all users in the store
      const users = await this.dataSource.query(
        `SELECT u.id, u.full_name
         FROM app_user u
         WHERE u.location = (SELECT location FROM stores WHERE id = $1)
         AND u.active = true AND u.archive = false`,
        [storeId],
      );

      const reports: LeaveReport[] = [];

      for (const user of users) {
        const leaves = await this.leaveRequestRepo.find({
          where: {
            userid: user.id,
            startdate: Between(startDate, endDate),
          },
          relations: ['leavetype'],
        });

        const totalRequests = leaves.length;
        const approvedRequests = leaves.filter(
          l => l.status === LeaveRequestStatus.APPROVED,
        ).length;
        const rejectedRequests = leaves.filter(
          l => l.status === LeaveRequestStatus.REJECTED,
        ).length;
        const pendingRequests = leaves.filter(
          l => l.status === LeaveRequestStatus.PENDING,
        ).length;

        const totalDaysTaken = leaves
          .filter(l => l.status === LeaveRequestStatus.APPROVED)
          .reduce((sum, l) => sum + Number(l.totaldays), 0);

        const byLeaveType: Record<string, number> = {};
        leaves
          .filter(l => l.status === LeaveRequestStatus.APPROVED)
          .forEach(l => {
            const typeName = l.leavetype.name;
            byLeaveType[typeName] = (byLeaveType[typeName] || 0) + Number(l.totaldays);
          });

        reports.push({
          userId: user.id,
          userName: user.full_name,
          totalRequests,
          approvedRequests,
          rejectedRequests,
          pendingRequests,
          totalDaysTaken,
          byLeaveType,
        });
      }

      return reports;
    } finally {
      await this.perfMonitor.logQueryPerformance(
        'reporting.leaveReport',
        Date.now() - startTime,
      );
    }
  }

  /**
   * Generate performance report for store
   */
  async generatePerformanceReport(
    storeId: number,
    year: number,
    month: number,
  ): Promise<PerformanceReport[]> {
    const startTime = Date.now();

    try {
      const scoreDate = new Date(year, month - 1, 1);

      // Get all users in the store with their scores
      const results = await this.dataSource.query(
        `SELECT
          u.id as user_id,
          u.full_name as user_name,
          COALESCE(us.total_score, 0) as total_score,
          COALESCE(us.grade, 'N/A') as grade,
          COALESCE(us.attendance_score, 0) as attendance_score,
          COALESCE(us.punctuality_score, 0) as punctuality_score,
          COALESCE(us.reliability_score, 0) as reliability_score,
          RANK() OVER (ORDER BY COALESCE(us.total_score, 0) DESC) as rank
         FROM app_user u
         LEFT JOIN user_score us ON u.id = us.user_id
           AND us.score_date = $1
           AND us.score_period = 'MONTHLY'
         WHERE u.location = (SELECT location FROM stores WHERE id = $2)
         AND u.active = true AND u.archive = false
         ORDER BY total_score DESC`,
        [scoreDate, storeId],
      );

      return results.map((r: any) => ({
        userId: r.user_id,
        userName: r.user_name,
        totalScore: Number(r.total_score),
        grade: r.grade,
        attendanceScore: Number(r.attendance_score),
        punctualityScore: Number(r.punctuality_score),
        reliabilityScore: Number(r.reliability_score),
        rank: Number(r.rank),
      }));
    } finally {
      await this.perfMonitor.logQueryPerformance(
        'reporting.performanceReport',
        Date.now() - startTime,
      );
    }
  }

  /**
   * Get dashboard summary for a user
   */
  async getUserDashboard(userId: number): Promise<any> {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    const [todayAttendance, monthlyAttendance, currentScore, pendingLeaves] =
      await Promise.all([
        this.attendanceRepo.findOne({
          where: {
            userid: userId,
            attendancedate: new Date(today.toISOString().split('T')[0]),
          },
        }),
        this.attendanceRepo.count({
          where: {
            userid: userId,
            attendancedate: Between(
              new Date(year, month - 1, 1),
              new Date(year, month, 0),
            ),
            status: AttendanceStatus.PRESENT,
          },
        }),
        this.scoreRepo.findOne({
          where: {
            userid: userId,
            scoredate: new Date(year, month - 1, 1),
            scoreperiod: ScorePeriod.MONTHLY,
          },
        }),
        this.leaveRequestRepo.count({
          where: {
            userid: userId,
            status: LeaveRequestStatus.PENDING,
          },
        }),
      ]);

    return {
      today: {
        clockedIn: !!todayAttendance?.clockintime,
        clockedOut: !!todayAttendance?.clockouttime,
        clockInTime: todayAttendance?.clockintime,
        clockOutTime: todayAttendance?.clockouttime,
        status: todayAttendance?.status || 'NOT_MARKED',
      },
      currentMonth: {
        presentDays: monthlyAttendance,
        totalScore: currentScore?.totalscore || 0,
        grade: currentScore?.grade || 'N/A',
        rank: await this.getUserRank(userId, year, month),
      },
      pendingActions: {
        pendingLeaveRequests: pendingLeaves,
      },
    };
  }

  /**
   * Get user rank for the month
   */
  private async getUserRank(
    userId: number,
    year: number,
    month: number,
  ): Promise<number> {
    const scoreDate = new Date(year, month - 1, 1);

    const result = await this.dataSource.query(
      `SELECT rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY total_score DESC) as rank
        FROM user_score
        WHERE score_date = $1 AND score_period = 'MONTHLY'
      ) ranked
      WHERE user_id = $2`,
      [scoreDate, userId],
    );

    return result.length > 0 ? result[0].rank : 0;
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
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }
}
