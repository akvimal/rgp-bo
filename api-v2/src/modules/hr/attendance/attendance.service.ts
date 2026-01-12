import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Attendance, AttendanceStatus } from '../../../entities/attendance.entity';
import { ClockInDto } from '../dto/attendance/clock-in.dto';
import { ClockOutDto } from '../dto/attendance/clock-out.dto';
import { UpdateAttendanceDto } from '../dto/attendance/update-attendance.dto';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';
import { PerformanceMonitoringService } from '../../../core/monitoring/performance-monitoring.service';
import { ShiftService } from '../shift/shift.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    private cacheService: RedisCacheService,
    private perfMonitor: PerformanceMonitoringService,
    private shiftService: ShiftService,
  ) {}

  /**
   * Clock in with optional webcam photo
   */
  async clockIn(
    userId: number,
    clockInDto: ClockInDto,
    photoFile?: Express.Multer.File,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const today = new Date().toISOString().split('T')[0];

      // Check if already clocked in today
      const existing = await this.attendanceRepo.findOne({
        where: {
          userid: userId,
          attendancedate: new Date(today),
        },
      });

      if (existing && existing.clockintime) {
        throw new ConflictException('Already clocked in today');
      }

      // Get user's current shift
      const userShift = await this.shiftService.getUserCurrentShift(userId);
      const shiftId = clockInDto.shiftid || userShift?.shiftid;

      if (!shiftId) {
        throw new BadRequestException('No shift assigned for today');
      }

      const now = new Date();

      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await this.savePhoto(userId, 'clock-in', photoFile);
      }

      // Check for late clock-in warning
      let warning: string | null = null;
      if (userShift?.shift) {
        const lateWarning = this.checkLateClockIn(now, userShift.shift);
        if (lateWarning) {
          warning = lateWarning;
        }
      }

      const attendance = this.attendanceRepo.create({
        userid: userId,
        attendancedate: new Date(today),
        shiftid: shiftId,
        clockintime: now,
        clockinphotourl: photoUrl,
        remarks: clockInDto.notes,
        status: AttendanceStatus.PENDING,
        createdby: userId,
        updatedby: userId,
      });

      const saved = await this.attendanceRepo.save(attendance);

      // Invalidate cache
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.ATTENDANCE_BY_USER_DATE(userId, today),
      );
      await this.invalidateMonthlyCache(userId, new Date(today));

      // Log performance
      await this.perfMonitor.logSystemMetric(
        'clock_in_time_ms',
        Date.now() - startTime,
        '/hr/attendance/clock-in',
      );

      // Log audit
      await this.perfMonitor.logAudit({
        userId,
        action: 'CLOCK_IN',
        resourceType: 'attendance',
        resourceId: saved.id,
        newValues: saved,
      });

      return {
        ...saved,
        warning,
      };
    } finally {
      await this.perfMonitor.logQueryPerformance(
        'attendance.clockIn',
        Date.now() - startTime,
      );
    }
  }

  /**
   * Clock out with optional webcam photo
   */
  async clockOut(
    userId: number,
    clockOutDto: ClockOutDto,
    photoFile?: Express.Multer.File,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const today = new Date().toISOString().split('T')[0];

      const attendance = await this.attendanceRepo.findOne({
        where: {
          userid: userId,
          attendancedate: new Date(today),
        },
        relations: ['shift'],
      });

      if (!attendance || !attendance.clockintime) {
        throw new NotFoundException('No clock-in record found for today');
      }

      if (attendance.clockouttime) {
        throw new ConflictException('Already clocked out today');
      }

      const now = new Date();

      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await this.savePhoto(userId, 'clock-out', photoFile);
      }

      // Check for early clock-out warning
      let warning: string | null = null;
      if (attendance.shift) {
        const earlyWarning = this.checkEarlyClockOut(now, attendance.shift);
        if (earlyWarning) {
          warning = earlyWarning;
        }
      }

      // Calculate total hours worked
      const totalHours = this.calculateWorkedHours(
        attendance.clockintime,
        now,
        attendance.shift?.breakduration || 0,
      );

      attendance.clockouttime = now;
      attendance.clockoutphotourl = photoUrl;
      attendance.totalhours = totalHours;
      attendance.status = AttendanceStatus.PRESENT;
      attendance.updatedby = userId;

      if (clockOutDto.notes) {
        attendance.remarks = attendance.remarks
          ? `${attendance.remarks}\n${clockOutDto.notes}`
          : clockOutDto.notes;
      }

      const saved = await this.attendanceRepo.save(attendance);

      // Invalidate cache
      await this.cacheService.del(
        this.cacheService.CACHE_KEYS.ATTENDANCE_BY_USER_DATE(userId, today),
      );
      await this.invalidateMonthlyCache(userId, new Date(today));

      // Log performance
      await this.perfMonitor.logSystemMetric(
        'clock_out_time_ms',
        Date.now() - startTime,
        '/hr/attendance/clock-out',
      );

      // Log audit
      await this.perfMonitor.logAudit({
        userId,
        action: 'CLOCK_OUT',
        resourceType: 'attendance',
        resourceId: saved.id,
        oldValues: attendance,
        newValues: saved,
      });

      return {
        ...saved,
        warning,
      };
    } finally {
      await this.perfMonitor.logQueryPerformance(
        'attendance.clockOut',
        Date.now() - startTime,
      );
    }
  }

  /**
   * Get attendance for a specific date
   */
  async getByUserAndDate(userId: number, date: string): Promise<Attendance | null> {
    const cacheKey = this.cacheService.CACHE_KEYS.ATTENDANCE_BY_USER_DATE(userId, date);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.attendanceRepo.findOne({
          where: {
            userid: userId,
            attendancedate: new Date(date),
          },
          relations: ['shift'],
        });
      },
      this.cacheService.TTL.SHORT,
    );
  }

  /**
   * Get monthly attendance for a user
   */
  async getMonthlyAttendance(
    userId: number,
    year: number,
    month: number,
  ): Promise<Attendance[]> {
    const cacheKey = this.cacheService.CACHE_KEYS.ATTENDANCE_MONTHLY(userId, year, month);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        return this.attendanceRepo.find({
          where: {
            userid: userId,
            attendancedate: Between(startDate, endDate),
          },
          relations: ['shift'],
          order: {
            attendancedate: 'ASC',
          },
        });
      },
      this.cacheService.TTL.MEDIUM,
    );
  }

  /**
   * Update attendance record (admin only)
   */
  async update(
    id: number,
    updateDto: UpdateAttendanceDto,
    adminId: number,
  ): Promise<Attendance> {
    const attendance = await this.attendanceRepo.findOne({ where: { id } });

    if (!attendance) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }

    const oldValues = { ...attendance };

    Object.assign(attendance, updateDto, { updatedby: adminId });

    // Recalculate total hours if times changed
    if (updateDto.clockintime || updateDto.clockouttime) {
      const clockIn = updateDto.clockintime || attendance.clockintime;
      const clockOut = updateDto.clockouttime || attendance.clockouttime;

      if (clockIn && clockOut) {
        attendance.totalhours = this.calculateWorkedHours(
          clockIn,
          clockOut,
          attendance.shift?.breakduration || 0,
        );
      }
    }

    const saved = await this.attendanceRepo.save(attendance);

    // Invalidate caches
    const date = attendance.attendancedate.toISOString().split('T')[0];
    await this.cacheService.del(
      this.cacheService.CACHE_KEYS.ATTENDANCE_BY_USER_DATE(attendance.userid, date),
    );
    await this.invalidateMonthlyCache(attendance.userid, attendance.attendancedate);

    // Log audit
    await this.perfMonitor.logAudit({
      userId: adminId,
      action: 'UPDATE_ATTENDANCE',
      resourceType: 'attendance',
      resourceId: id,
      oldValues,
      newValues: saved,
    });

    return saved;
  }

  /**
   * Calculate worked hours between two timestamps
   */
  private calculateWorkedHours(
    clockIn: Date,
    clockOut: Date,
    breakMinutes: number = 0,
  ): number {
    const totalMilliseconds = clockOut.getTime() - clockIn.getTime();
    const totalMinutes = totalMilliseconds / (1000 * 60);
    const workedMinutes = Math.max(0, totalMinutes - breakMinutes);
    const workedHours = workedMinutes / 60;

    // Round to 2 decimal places
    return Math.round(workedHours * 100) / 100;
  }

  /**
   * Check if clock-in is late (more than grace period + 5 minutes)
   */
  private checkLateClockIn(clockInTime: Date, shift: any): string | null {
    if (!shift || !shift.starttime) {
      return null;
    }

    const [shiftHour, shiftMin] = shift.starttime.split(':').map(Number);
    const gracePeriod = shift.graceperiodminutes || 0;
    const warningThreshold = 5; // 5 minutes after grace period

    const shiftStart = new Date(clockInTime);
    shiftStart.setHours(shiftHour, shiftMin, 0, 0);

    const allowedLatestTime = new Date(shiftStart.getTime() + (gracePeriod + warningThreshold) * 60000);

    if (clockInTime > allowedLatestTime) {
      const minutesLate = Math.floor((clockInTime.getTime() - shiftStart.getTime()) / 60000);
      return `You are clocking in ${minutesLate} minutes late. Your shift started at ${shift.starttime}.`;
    }

    return null;
  }

  /**
   * Check if clock-out is early (more than 5 minutes before shift end)
   */
  private checkEarlyClockOut(clockOutTime: Date, shift: any): string | null {
    if (!shift || !shift.endtime) {
      return null;
    }

    const [shiftHour, shiftMin] = shift.endtime.split(':').map(Number);
    const warningThreshold = 5; // 5 minutes before shift end

    const shiftEnd = new Date(clockOutTime);
    shiftEnd.setHours(shiftHour, shiftMin, 0, 0);

    const earliestAllowedTime = new Date(shiftEnd.getTime() - warningThreshold * 60000);

    if (clockOutTime < earliestAllowedTime) {
      const minutesEarly = Math.floor((shiftEnd.getTime() - clockOutTime.getTime()) / 60000);
      return `You are clocking out ${minutesEarly} minutes early. Your shift ends at ${shift.endtime}.`;
    }

    return null;
  }

  /**
   * Save photo to file system
   */
  private async savePhoto(
    userId: number,
    type: 'clock-in' | 'clock-out',
    file: Express.Multer.File,
  ): Promise<string> {
    const uploadDir = process.env.FILEUPLOAD_LOCATION || '/app/upload';
    const hrPhotosDir = path.join(uploadDir, 'hr', 'attendance');

    // Ensure directory exists
    await fs.mkdir(hrPhotosDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `${userId}_${type}_${timestamp}${path.extname(file.originalname)}`;
    const filepath = path.join(hrPhotosDir, filename);

    await fs.writeFile(filepath, file.buffer);

    return `/upload/hr/attendance/${filename}`;
  }

  /**
   * Invalidate monthly cache for a date
   */
  private async invalidateMonthlyCache(userId: number, date: Date): Promise<void> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    await this.cacheService.del(
      this.cacheService.CACHE_KEYS.ATTENDANCE_MONTHLY(userId, year, month),
    );
  }
}
