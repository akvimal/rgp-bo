# HR Features Implementation Proposal

**Date:** 2025-11-30
**Project:** RGP Back Office System
**Features:** Shift Management, Leave Tracking, Attendance (Webcam Entry/Exit), User Reporting & Scoring

---

## Executive Summary

This proposal outlines the implementation of comprehensive HR management features for the RGP Back Office System. These features will enable:

1. **Shift Management**: Define and assign work shifts to employees
2. **Leave Tracking**: Request, approve, and track employee leaves
3. **Attendance System**: Webcam-based clock-in/clock-out with face verification
4. **Reporting & Scoring**: Generate performance reports and user scoring based on attendance and productivity metrics

---

## Table of Contents

1. [Current System Analysis](#1-current-system-analysis)
2. [Proposed Architecture](#2-proposed-architecture)
3. [Database Schema Design](#3-database-schema-design)
4. [Backend API Structure](#4-backend-api-structure)
5. [Frontend Integration](#5-frontend-integration)
6. [Webcam Integration](#6-webcam-integration)
7. [Reporting & Scoring System](#7-reporting--scoring-system)
8. [Security & Privacy](#8-security--privacy)
9. [Implementation Phases](#9-implementation-phases)
10. [Effort Estimation](#10-effort-estimation)

---

## 1. Current System Analysis

### 1.1 Existing Infrastructure

**Strengths to Leverage:**
- ✅ Role-based access control (app_role, app_user)
- ✅ BaseEntity with audit fields (created_on, updated_on, created_by, updated_by)
- ✅ Transaction support with SERIALIZABLE isolation
- ✅ Global error handling infrastructure
- ✅ JWT authentication
- ✅ File upload capability (files module)
- ✅ Business and Store entity structure
- ✅ Comprehensive logging

**Existing User Structure:**
```typescript
app_user {
  id, email, phone, full_name, location, password,
  role_id, last_login, active, archive,
  created_on, updated_on, created_by, updated_by
}
```

### 1.2 Integration Points

The HR features will integrate with:
- **app_user**: Employee master data
- **app_role**: Permission-based access to HR features
- **stores**: Shift assignment by location
- **business**: Multi-business support if needed
- **documents**: Store attendance photos, leave documents

---

## 2. Proposed Architecture

### 2.1 Module Structure

```
api-v2/src/modules/app/hr/
├── attendance/
│   ├── attendance.controller.ts
│   ├── attendance.service.ts
│   ├── attendance.module.ts
│   └── dto/
│       ├── create-attendance.dto.ts
│       ├── clock-in.dto.ts
│       └── clock-out.dto.ts
├── shifts/
│   ├── shift.controller.ts
│   ├── shift.service.ts
│   ├── shift.module.ts
│   └── dto/
│       ├── create-shift.dto.ts
│       └── assign-shift.dto.ts
├── leaves/
│   ├── leave.controller.ts
│   ├── leave.service.ts
│   ├── leave.module.ts
│   └── dto/
│       ├── create-leave-request.dto.ts
│       └── approve-leave.dto.ts
└── reports/
    ├── hr-report.controller.ts
    ├── hr-report.service.ts
    ├── hr-report.module.ts
    └── dto/
        └── user-score-report.dto.ts
```

### 2.2 Entity Structure

```
api-v2/src/entities/
├── shift.entity.ts              # Shift definitions
├── user-shift.entity.ts         # User shift assignments
├── attendance.entity.ts         # Daily attendance records
├── leave-type.entity.ts         # Leave type master
├── leave-request.entity.ts      # Leave requests
├── user-score.entity.ts         # User performance scores (computed)
└── attendance-photo.entity.ts   # Webcam photos reference
```

---

## 3. Database Schema Design

### 3.1 Shift Management

#### Table: `shift`
```sql
CREATE TABLE public.shift (
    id SERIAL4 PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                    -- e.g., "Morning Shift", "Evening Shift"
    description TEXT,
    start_time TIME NOT NULL,                      -- e.g., "09:00:00"
    end_time TIME NOT NULL,                        -- e.g., "18:00:00"
    break_duration INT DEFAULT 0,                  -- Break in minutes
    grace_period_minutes INT DEFAULT 15,           -- Late arrival grace period
    store_id INT4 REFERENCES stores(id),           -- Optional: shift specific to store
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id),
    CONSTRAINT shift_un UNIQUE (name, store_id)
);

CREATE INDEX idx_shift_active ON shift(active, archive) WHERE active = true AND archive = false;
```

#### Table: `user_shift`
```sql
CREATE TABLE public.user_shift (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    shift_id INT4 NOT NULL REFERENCES shift(id),
    effective_from DATE NOT NULL,                  -- When this assignment starts
    effective_to DATE,                             -- NULL = ongoing
    days_of_week VARCHAR(20) NOT NULL,             -- JSON array: ["MON","TUE","WED","THU","FRI"]
    is_default BOOL DEFAULT false,                 -- Default shift for this user
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id),
    CONSTRAINT user_shift_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT user_shift_fk_1 FOREIGN KEY (shift_id) REFERENCES shift(id)
);

CREATE INDEX idx_user_shift_user ON user_shift(user_id, effective_from, effective_to);
CREATE INDEX idx_user_shift_active ON user_shift(active, archive) WHERE active = true AND archive = false;
```

### 3.2 Attendance Management

#### Table: `attendance`
```sql
CREATE TABLE public.attendance (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    attendance_date DATE NOT NULL,
    shift_id INT4 REFERENCES shift(id),

    -- Clock In/Out
    clock_in_time TIMESTAMPTZ,
    clock_out_time TIMESTAMPTZ,
    clock_in_photo_path VARCHAR(500),              -- Path to webcam photo
    clock_out_photo_path VARCHAR(500),             -- Path to webcam photo
    clock_in_ip VARCHAR(45),                       -- IP address for audit
    clock_out_ip VARCHAR(45),
    clock_in_device VARCHAR(200),                  -- Device info/user agent
    clock_out_device VARCHAR(200),

    -- Calculated Fields
    total_hours DECIMAL(5,2),                      -- Actual working hours
    is_late BOOL DEFAULT false,                    -- Late arrival flag
    late_minutes INT DEFAULT 0,                    -- Minutes late
    is_early_departure BOOL DEFAULT false,         -- Left before shift end
    early_departure_minutes INT DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',          -- PENDING, PRESENT, ABSENT, HALF_DAY, ON_LEAVE
    remarks TEXT,                                  -- Manual remarks by admin
    is_manual_entry BOOL DEFAULT false,            -- Manually added by admin

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id),

    CONSTRAINT attendance_un UNIQUE (user_id, attendance_date)
);

CREATE INDEX idx_attendance_user_date ON attendance(user_id, attendance_date DESC);
CREATE INDEX idx_attendance_date ON attendance(attendance_date DESC);
CREATE INDEX idx_attendance_status ON attendance(status, attendance_date);
```

### 3.3 Leave Management

#### Table: `leave_type`
```sql
CREATE TABLE public.leave_type (
    id SERIAL4 PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,              -- e.g., "Sick Leave", "Casual Leave", "Earned Leave"
    code VARCHAR(20) NOT NULL UNIQUE,              -- e.g., "SL", "CL", "EL"
    description TEXT,
    max_days_per_year INT DEFAULT 0,               -- Annual quota
    requires_document BOOL DEFAULT false,           -- Medical certificate required?
    is_paid BOOL DEFAULT true,
    carry_forward BOOL DEFAULT false,               -- Can unused leaves carry forward?
    color_code VARCHAR(7),                         -- For UI display: #FF5733
    active BOOL DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id)
);
```

#### Table: `leave_request`
```sql
CREATE TABLE public.leave_request (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    leave_type_id INT4 NOT NULL REFERENCES leave_type(id),

    -- Leave Details
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(3,1) NOT NULL,              -- 1.0, 1.5, 2.0 (half days supported)
    reason TEXT NOT NULL,
    document_path VARCHAR(500),                    -- Supporting document (medical cert, etc.)

    -- Approval Workflow
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL, -- PENDING, APPROVED, REJECTED, CANCELLED
    applied_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_by INT4 REFERENCES app_user(id),
    approved_on TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Audit
    active BOOL DEFAULT true NOT NULL,
    archive BOOL DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id),

    CONSTRAINT leave_request_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT leave_request_fk_1 FOREIGN KEY (leave_type_id) REFERENCES leave_type(id),
    CONSTRAINT leave_request_fk_2 FOREIGN KEY (approved_by) REFERENCES app_user(id)
);

CREATE INDEX idx_leave_request_user ON leave_request(user_id, status, start_date DESC);
CREATE INDEX idx_leave_request_status ON leave_request(status, applied_on DESC);
CREATE INDEX idx_leave_request_dates ON leave_request(start_date, end_date);
```

#### Table: `leave_balance`
```sql
CREATE TABLE public.leave_balance (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    leave_type_id INT4 NOT NULL REFERENCES leave_type(id),
    year INT NOT NULL,                             -- Financial year or calendar year

    -- Balance Tracking
    opening_balance DECIMAL(4,1) DEFAULT 0,        -- Carried forward + annual quota
    earned DECIMAL(4,1) DEFAULT 0,                 -- Accrued during the year
    used DECIMAL(4,1) DEFAULT 0,                   -- Leaves taken
    balance DECIMAL(4,1) DEFAULT 0,                -- Available balance

    -- Audit
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT leave_balance_un UNIQUE (user_id, leave_type_id, year),
    CONSTRAINT leave_balance_fk FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT leave_balance_fk_1 FOREIGN KEY (leave_type_id) REFERENCES leave_type(id)
);

CREATE INDEX idx_leave_balance_user_year ON leave_balance(user_id, year DESC);
```

### 3.4 User Scoring & Performance

#### Table: `user_score`
```sql
CREATE TABLE public.user_score (
    id SERIAL4 PRIMARY KEY,
    user_id INT4 NOT NULL REFERENCES app_user(id),
    score_date DATE NOT NULL,                      -- Daily score
    score_period VARCHAR(20) DEFAULT 'DAILY',      -- DAILY, WEEKLY, MONTHLY

    -- Score Components
    attendance_score DECIMAL(5,2) DEFAULT 0,       -- 0-100 based on attendance
    punctuality_score DECIMAL(5,2) DEFAULT 0,      -- 0-100 based on on-time arrival
    working_hours_score DECIMAL(5,2) DEFAULT 0,    -- 0-100 based on hours worked
    leave_utilization_score DECIMAL(5,2) DEFAULT 0,-- 0-100 based on leave pattern

    -- Overall Score
    total_score DECIMAL(5,2) DEFAULT 0,            -- Weighted average
    grade VARCHAR(2),                              -- A+, A, B+, B, C, D, F

    -- Metrics
    total_working_days INT DEFAULT 0,
    present_days INT DEFAULT 0,
    absent_days INT DEFAULT 0,
    late_arrivals INT DEFAULT 0,
    early_departures INT DEFAULT 0,
    leaves_taken DECIMAL(3,1) DEFAULT 0,
    total_hours_worked DECIMAL(6,2) DEFAULT 0,

    -- Audit
    calculated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT user_score_un UNIQUE (user_id, score_date, score_period),
    CONSTRAINT user_score_fk FOREIGN KEY (user_id) REFERENCES app_user(id)
);

CREATE INDEX idx_user_score_user ON user_score(user_id, score_date DESC);
CREATE INDEX idx_user_score_period ON user_score(score_period, score_date DESC);
CREATE INDEX idx_user_score_grade ON user_score(grade, score_date DESC);
```

---

## 4. Backend API Structure

### 4.1 Entities (TypeORM)

#### `shift.entity.ts`
```typescript
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Store } from './store.entity';
import { UserShift } from './user-shift.entity';

@Entity('shift')
export class Shift extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'int', default: 0 })
  breakDuration: number;

  @Column({ type: 'int', default: 15 })
  gracePeriodMinutes: number;

  @Column({ type: 'int', nullable: true })
  storeId: number;

  @ManyToOne(() => Store, { nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @OneToMany(() => UserShift, userShift => userShift.shift)
  userShifts: UserShift[];
}
```

#### `attendance.entity.ts`
```typescript
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AppUser } from './appuser.entity';
import { Shift } from './shift.entity';

@Entity('attendance')
export class Attendance extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'date' })
  attendanceDate: Date;

  @Column({ type: 'int', nullable: true })
  shiftId: number;

  @Column({ type: 'timestamptz', nullable: true })
  clockInTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  clockOutTime: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  clockInPhotoPath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  clockOutPhotoPath: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  clockInIp: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  clockOutIp: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  totalHours: number;

  @Column({ type: 'bool', default: false })
  isLate: boolean;

  @Column({ type: 'int', default: 0 })
  lateMinutes: number;

  @Column({ type: 'bool', default: false })
  isEarlyDeparture: boolean;

  @Column({ type: 'int', default: 0 })
  earlyDepartureMinutes: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string; // PENDING, PRESENT, ABSENT, HALF_DAY, ON_LEAVE

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'bool', default: false })
  isManualEntry: boolean;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @ManyToOne(() => Shift, { nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;
}
```

#### `leave-request.entity.ts`
```typescript
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AppUser } from './appuser.entity';
import { LeaveType } from './leave-type.entity';

@Entity('leave_request')
export class LeaveRequest extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  leaveTypeId: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'decimal', precision: 3, scale: 1 })
  totalDays: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentPath: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string; // PENDING, APPROVED, REJECTED, CANCELLED

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  appliedOn: Date;

  @Column({ type: 'int', nullable: true })
  approvedBy: number;

  @Column({ type: 'timestamptz', nullable: true })
  approvedOn: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: AppUser;
}
```

### 4.2 DTOs

#### `dto/clock-in.dto.ts`
```typescript
import { IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClockInDto {
  @ApiProperty({ description: 'Base64 encoded webcam photo' })
  @IsNotEmpty()
  @IsString()
  photo: string;

  @ApiProperty({ description: 'Optional remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ description: 'Attendance date (optional, defaults to today)' })
  @IsOptional()
  @IsDateString()
  attendanceDate?: string;
}
```

#### `dto/create-leave-request.dto.ts`
```typescript
import { IsNotEmpty, IsNumber, IsDateString, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  leaveTypeId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentPath?: string;
}
```

### 4.3 Services

#### `attendance.service.ts` (Key Methods)
```typescript
@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(UserShift)
    private userShiftRepo: Repository<UserShift>,
    private filesService: FilesService,
  ) {}

  async clockIn(userId: number, dto: ClockInDto, ip: string, device: string): Promise<Attendance> {
    return await this.attendanceRepo.manager.transaction(async (manager) => {
      try {
        const attendanceDate = dto.attendanceDate ? new Date(dto.attendanceDate) : new Date();

        // Check if already clocked in today
        const existing = await manager.findOne(Attendance, {
          where: { userId, attendanceDate }
        });

        if (existing && existing.clockInTime) {
          throw new BusinessException('Already clocked in for today');
        }

        // Get user's assigned shift for today
        const shift = await this.getUserShiftForDate(userId, attendanceDate);

        // Save photo to file system
        const photoPath = await this.saveWebcamPhoto(userId, dto.photo, 'clock-in');

        // Calculate if late
        const clockInTime = new Date();
        const { isLate, lateMinutes } = this.calculateLateness(clockInTime, shift);

        const attendance = existing || new Attendance();
        attendance.userId = userId;
        attendance.attendanceDate = attendanceDate;
        attendance.shiftId = shift?.id;
        attendance.clockInTime = clockInTime;
        attendance.clockInPhotoPath = photoPath;
        attendance.clockInIp = ip;
        attendance.clockInDevice = device;
        attendance.isLate = isLate;
        attendance.lateMinutes = lateMinutes;
        attendance.status = 'PRESENT';
        attendance.createdby = userId;

        return await manager.save(Attendance, attendance);
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new HttpException('Failed to clock in', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }

  async clockOut(userId: number, dto: ClockOutDto, ip: string, device: string): Promise<Attendance> {
    return await this.attendanceRepo.manager.transaction(async (manager) => {
      try {
        const today = new Date();
        const attendance = await manager.findOne(Attendance, {
          where: { userId, attendanceDate: today }
        });

        if (!attendance) {
          throw new NotFoundException('No clock-in record found for today');
        }

        if (attendance.clockOutTime) {
          throw new BusinessException('Already clocked out for today');
        }

        // Save photo
        const photoPath = await this.saveWebcamPhoto(userId, dto.photo, 'clock-out');

        // Calculate total hours and early departure
        const clockOutTime = new Date();
        const totalHours = this.calculateTotalHours(attendance.clockInTime, clockOutTime);
        const { isEarly, earlyMinutes } = this.calculateEarlyDeparture(clockOutTime, attendance.shift);

        attendance.clockOutTime = clockOutTime;
        attendance.clockOutPhotoPath = photoPath;
        attendance.clockOutIp = ip;
        attendance.clockOutDevice = device;
        attendance.totalHours = totalHours;
        attendance.isEarlyDeparture = isEarly;
        attendance.earlyDepartureMinutes = earlyMinutes;
        attendance.updatedby = userId;

        return await manager.save(Attendance, attendance);
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new HttpException('Failed to clock out', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }

  async getMyAttendance(userId: number, startDate: Date, endDate: Date): Promise<Attendance[]> {
    return this.attendanceRepo.find({
      where: {
        userId,
        attendanceDate: Between(startDate, endDate)
      },
      relations: ['shift'],
      order: { attendanceDate: 'DESC' }
    });
  }

  private async saveWebcamPhoto(userId: number, base64Photo: string, type: string): Promise<string> {
    const buffer = Buffer.from(base64Photo.split(',')[1], 'base64');
    const filename = `attendance_${userId}_${type}_${Date.now()}.jpg`;
    const filepath = path.join('uploads', 'attendance', filename);

    await this.filesService.saveFile(filepath, buffer);
    return filepath;
  }

  private calculateLateness(clockInTime: Date, shift: Shift): { isLate: boolean; lateMinutes: number } {
    if (!shift) return { isLate: false, lateMinutes: 0 };

    const shiftStart = this.parseTime(shift.startTime);
    const gracePeriod = shift.gracePeriodMinutes || 0;
    const allowedTime = new Date(clockInTime);
    allowedTime.setHours(shiftStart.hours, shiftStart.minutes + gracePeriod);

    if (clockInTime > allowedTime) {
      const lateMinutes = Math.floor((clockInTime.getTime() - allowedTime.getTime()) / 60000);
      return { isLate: true, lateMinutes };
    }

    return { isLate: false, lateMinutes: 0 };
  }
}
```

#### `leave.service.ts` (Key Methods)
```typescript
@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private balanceRepo: Repository<LeaveBalance>,
  ) {}

  async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    return await this.leaveRepo.manager.transaction(async (manager) => {
      try {
        // Calculate total days
        const totalDays = this.calculateLeaveDays(new Date(dto.startDate), new Date(dto.endDate));

        // Check leave balance
        const balance = await this.getLeaveBalance(userId, dto.leaveTypeId);
        if (balance.balance < totalDays) {
          throw new BusinessException(
            `Insufficient leave balance. Available: ${balance.balance}, Requested: ${totalDays}`
          );
        }

        // Check for overlapping leave requests
        const overlap = await this.checkOverlappingLeaves(userId, dto.startDate, dto.endDate);
        if (overlap) {
          throw new BusinessException('Leave request overlaps with existing leave');
        }

        const leaveRequest = manager.create(LeaveRequest, {
          ...dto,
          userId,
          totalDays,
          status: 'PENDING',
          createdby: userId
        });

        return await manager.save(LeaveRequest, leaveRequest);
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new HttpException('Failed to create leave request', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }

  async approveLeave(leaveId: number, approvedBy: number, remarks?: string): Promise<LeaveRequest> {
    return await this.leaveRepo.manager.transaction(async (manager) => {
      try {
        const leave = await manager.findOne(LeaveRequest, { where: { id: leaveId } });

        if (!leave) {
          throw new NotFoundException('Leave request not found');
        }

        if (leave.status !== 'PENDING') {
          throw new BusinessException('Leave request is not in pending status');
        }

        // Update leave request
        leave.status = 'APPROVED';
        leave.approvedBy = approvedBy;
        leave.approvedOn = new Date();
        leave.updatedby = approvedBy;

        await manager.save(LeaveRequest, leave);

        // Update leave balance
        await this.deductLeaveBalance(leave.userId, leave.leaveTypeId, leave.totalDays);

        // Mark attendance as ON_LEAVE for the leave period
        await this.markAttendanceAsLeave(leave.userId, leave.startDate, leave.endDate);

        return leave;
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new HttpException('Failed to approve leave', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }

  async getMyLeaves(userId: number, status?: string): Promise<LeaveRequest[]> {
    const where: any = { userId };
    if (status) where.status = status;

    return this.leaveRepo.find({
      where,
      relations: ['leaveType', 'approver'],
      order: { appliedOn: 'DESC' }
    });
  }

  async getPendingApprovals(approverId: number): Promise<LeaveRequest[]> {
    // Get leaves for users under this approver (based on role hierarchy)
    return this.leaveRepo.find({
      where: { status: 'PENDING' },
      relations: ['user', 'leaveType'],
      order: { appliedOn: 'ASC' }
    });
  }
}
```

#### `hr-report.service.ts` (Scoring & Reporting)
```typescript
@Injectable()
export class HrReportService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(UserScore)
    private scoreRepo: Repository<UserScore>,
    @InjectRepository(LeaveRequest)
    private leaveRepo: Repository<LeaveRequest>,
  ) {}

  async calculateUserScore(userId: number, startDate: Date, endDate: Date): Promise<UserScore> {
    // Get attendance records
    const attendances = await this.attendanceRepo.find({
      where: {
        userId,
        attendanceDate: Between(startDate, endDate)
      }
    });

    // Calculate metrics
    const totalWorkingDays = this.getWorkingDays(startDate, endDate);
    const presentDays = attendances.filter(a => a.status === 'PRESENT').length;
    const absentDays = totalWorkingDays - presentDays;
    const lateArrivals = attendances.filter(a => a.isLate).length;
    const earlyDepartures = attendances.filter(a => a.isEarlyDeparture).length;
    const totalHoursWorked = attendances.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    // Get leave data
    const leaves = await this.leaveRepo.find({
      where: {
        userId,
        status: 'APPROVED',
        startDate: Between(startDate, endDate)
      }
    });
    const leavesTaken = leaves.reduce((sum, l) => sum + l.totalDays, 0);

    // Calculate component scores (0-100)
    const attendanceScore = (presentDays / totalWorkingDays) * 100;
    const punctualityScore = ((presentDays - lateArrivals) / presentDays) * 100 || 0;
    const workingHoursScore = Math.min((totalHoursWorked / (totalWorkingDays * 8)) * 100, 100);
    const leaveUtilizationScore = this.calculateLeaveUtilizationScore(leavesTaken, totalWorkingDays);

    // Weighted total score
    const totalScore = (
      attendanceScore * 0.4 +
      punctualityScore * 0.3 +
      workingHoursScore * 0.2 +
      leaveUtilizationScore * 0.1
    );

    // Determine grade
    const grade = this.getGrade(totalScore);

    const userScore = this.scoreRepo.create({
      userId,
      scoreDate: endDate,
      scorePeriod: 'MONTHLY',
      attendanceScore,
      punctualityScore,
      workingHoursScore,
      leaveUtilizationScore,
      totalScore,
      grade,
      totalWorkingDays,
      presentDays,
      absentDays,
      lateArrivals,
      earlyDepartures,
      leavesTaken,
      totalHoursWorked
    });

    return await this.scoreRepo.save(userScore);
  }

  async getUserScoreReport(userId: number, year: number, month: number): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const score = await this.scoreRepo.findOne({
      where: {
        userId,
        scoreDate: endDate,
        scorePeriod: 'MONTHLY'
      }
    });

    if (!score) {
      // Calculate if not exists
      return await this.calculateUserScore(userId, startDate, endDate);
    }

    // Get detailed attendance breakdown
    const attendances = await this.attendanceRepo.find({
      where: {
        userId,
        attendanceDate: Between(startDate, endDate)
      },
      order: { attendanceDate: 'ASC' }
    });

    return {
      score,
      attendances,
      summary: {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        totalScore: score.totalScore,
        grade: score.grade,
        rank: await this.getUserRank(userId, endDate),
        improvement: await this.getScoreImprovement(userId, year, month)
      }
    };
  }

  private getGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  async getAllUsersScoreReport(year: number, month: number): Promise<any[]> {
    const endDate = new Date(year, month, 0);

    const scores = await this.scoreRepo.find({
      where: {
        scoreDate: endDate,
        scorePeriod: 'MONTHLY'
      },
      relations: ['user'],
      order: { totalScore: 'DESC' }
    });

    return scores.map((score, index) => ({
      rank: index + 1,
      userId: score.userId,
      userName: score.user.fullname,
      totalScore: score.totalScore,
      grade: score.grade,
      presentDays: score.presentDays,
      lateArrivals: score.lateArrivals,
      totalHoursWorked: score.totalHoursWorked
    }));
  }
}
```

### 4.4 Controllers

#### `attendance.controller.ts`
```typescript
@ApiTags('Attendance')
@Controller('attendance')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in with webcam photo' })
  async clockIn(
    @Body() dto: ClockInDto,
    @User() currentUser: any,
    @Req() request: Request
  ) {
    const ip = request.ip;
    const device = request.headers['user-agent'];
    return this.attendanceService.clockIn(currentUser.id, dto, ip, device);
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock out with webcam photo' })
  async clockOut(
    @Body() dto: ClockOutDto,
    @User() currentUser: any,
    @Req() request: Request
  ) {
    const ip = request.ip;
    const device = request.headers['user-agent'];
    return this.attendanceService.clockOut(currentUser.id, dto, ip, device);
  }

  @Get('my-attendance')
  @ApiOperation({ summary: 'Get my attendance history' })
  async getMyAttendance(
    @User() currentUser: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.attendanceService.getMyAttendance(
      currentUser.id,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today\'s attendance status' })
  async getTodayAttendance(@User() currentUser: any) {
    const today = new Date();
    return this.attendanceService.getTodayAttendance(currentUser.id, today);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user attendance (Admin/Manager only)' })
  async getUserAttendance(
    @Param('userId') userId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.attendanceService.getMyAttendance(
      userId,
      new Date(startDate),
      new Date(endDate)
    );
  }
}
```

#### `leave.controller.ts`
```typescript
@ApiTags('Leave Management')
@Controller('leaves')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @Post()
  @ApiOperation({ summary: 'Apply for leave' })
  async createLeaveRequest(
    @Body() dto: CreateLeaveRequestDto,
    @User() currentUser: any
  ) {
    return this.leaveService.createLeaveRequest(currentUser.id, dto);
  }

  @Get('my-leaves')
  @ApiOperation({ summary: 'Get my leave requests' })
  async getMyLeaves(
    @User() currentUser: any,
    @Query('status') status?: string
  ) {
    return this.leaveService.getMyLeaves(currentUser.id, status);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get my leave balance' })
  async getMyLeaveBalance(@User() currentUser: any) {
    return this.leaveService.getAllLeaveBalances(currentUser.id);
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'Get pending leave approvals (Manager/Admin)' })
  async getPendingApprovals(@User() currentUser: any) {
    return this.leaveService.getPendingApprovals(currentUser.id);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve leave request' })
  async approveLeave(
    @Param('id') id: number,
    @User() currentUser: any,
    @Body('remarks') remarks?: string
  ) {
    return this.leaveService.approveLeave(id, currentUser.id, remarks);
  }

  @Put(':id/reject')
  @ApiOperation({ summary: 'Reject leave request' })
  async rejectLeave(
    @Param('id') id: number,
    @User() currentUser: any,
    @Body('reason') reason: string
  ) {
    return this.leaveService.rejectLeave(id, currentUser.id, reason);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel leave request' })
  async cancelLeave(
    @Param('id') id: number,
    @User() currentUser: any
  ) {
    return this.leaveService.cancelLeave(id, currentUser.id);
  }
}
```

#### `hr-report.controller.ts`
```typescript
@ApiTags('HR Reports')
@Controller('hr-reports')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class HrReportController {
  constructor(private reportService: HrReportService) {}

  @Get('my-score')
  @ApiOperation({ summary: 'Get my performance score' })
  async getMyScore(
    @User() currentUser: any,
    @Query('year') year: number,
    @Query('month') month: number
  ) {
    return this.reportService.getUserScoreReport(currentUser.id, year, month);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get performance leaderboard' })
  async getLeaderboard(
    @Query('year') year: number,
    @Query('month') month: number
  ) {
    return this.reportService.getAllUsersScoreReport(year, month);
  }

  @Get('user/:userId/score')
  @ApiOperation({ summary: 'Get user performance score (Admin/Manager)' })
  async getUserScore(
    @Param('userId') userId: number,
    @Query('year') year: number,
    @Query('month') month: number
  ) {
    return this.reportService.getUserScoreReport(userId, year, month);
  }

  @Post('calculate-scores')
  @ApiOperation({ summary: 'Calculate all users scores for a period (Admin only)' })
  async calculateAllScores(
    @Body('year') year: number,
    @Body('month') month: number
  ) {
    return this.reportService.calculateAllUsersScores(year, month);
  }

  @Get('attendance-summary')
  @ApiOperation({ summary: 'Get attendance summary report' })
  async getAttendanceSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: number
  ) {
    return this.reportService.getAttendanceSummaryReport(
      new Date(startDate),
      new Date(endDate),
      userId
    );
  }
}
```

---

## 5. Frontend Integration

### 5.1 New Angular Modules

```
frontend/src/app/
├── modules/
│   └── hr/
│       ├── attendance/
│       │   ├── clock-in/
│       │   │   ├── clock-in.component.ts
│       │   │   ├── clock-in.component.html
│       │   │   └── webcam-capture.component.ts
│       │   ├── clock-out/
│       │   ├── my-attendance/
│       │   └── attendance-report/
│       ├── leaves/
│       │   ├── apply-leave/
│       │   ├── my-leaves/
│       │   ├── leave-balance/
│       │   └── approve-leaves/
│       ├── shifts/
│       │   ├── shift-list/
│       │   ├── my-shifts/
│       │   └── assign-shift/
│       └── reports/
│           ├── my-score/
│           ├── leaderboard/
│           └── team-report/
```

### 5.2 Webcam Integration

**Recommended Libraries:**
- `ngx-webcam`: Angular webcam component
- `face-api.js`: Optional face detection/verification

**Clock-In Component Example:**
```typescript
import { Component } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { WebcamImage, WebcamInitError } from 'ngx-webcam';

@Component({
  selector: 'app-clock-in',
  template: `
    <div class="clock-in-container">
      <h2>Clock In</h2>

      <div class="webcam-section">
        <webcam
          [trigger]="triggerObservable"
          (imageCapture)="handleImage($event)"
          [width]="640"
          [height]="480">
        </webcam>

        <button (click)="capturePhoto()" class="btn btn-primary">
          Capture Photo
        </button>
      </div>

      <div *ngIf="webcamImage" class="preview-section">
        <h3>Preview</h3>
        <img [src]="webcamImage.imageAsDataUrl" />

        <textarea [(ngModel)]="remarks" placeholder="Optional remarks"></textarea>

        <button (click)="confirmClockIn()" class="btn btn-success">
          Confirm Clock In
        </button>
      </div>
    </div>
  `
})
export class ClockInComponent {
  public webcamImage: WebcamImage = null;
  private trigger: Subject<void> = new Subject<void>();
  public remarks: string = '';

  constructor(private attendanceService: AttendanceService) {}

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public capturePhoto(): void {
    this.trigger.next();
  }

  public handleImage(webcamImage: WebcamImage): void {
    this.webcamImage = webcamImage;
  }

  public confirmClockIn(): void {
    const dto = {
      photo: this.webcamImage.imageAsDataUrl,
      remarks: this.remarks
    };

    this.attendanceService.clockIn(dto).subscribe(
      (response) => {
        alert('Clocked in successfully!');
        this.router.navigate(['/hr/attendance/today']);
      },
      (error) => {
        alert('Error clocking in: ' + error.message);
      }
    );
  }
}
```

### 5.3 Dashboard Widgets

**Employee Dashboard:**
- Today's attendance status (clocked in/out)
- Current shift information
- Leave balance summary
- My performance score widget
- Upcoming leaves

**Manager Dashboard:**
- Team attendance overview
- Pending leave approvals
- Team performance leaderboard
- Late arrivals/early departures alerts

---

## 6. Webcam Integration

### 6.1 Photo Storage Strategy

**Directory Structure:**
```
uploads/
└── attendance/
    └── 2025/
        └── 11/
            ├── user_1_clock-in_1732956789123.jpg
            ├── user_1_clock-out_1732987654321.jpg
            └── ...
```

**Photo Retention Policy:**
- Keep for 90 days for audit purposes
- Automatic cleanup job (cron) to delete old photos
- Option to archive to cloud storage (S3, Azure Blob)

### 6.2 Face Verification (Optional Enhancement)

**Future Enhancement:**
- Store user's reference face photo during onboarding
- Use face-api.js or AWS Rekognition to verify identity
- Prevent buddy punching (someone else clocking in)
- Face matching threshold: 90% confidence

**Implementation:**
```typescript
async verifyFace(userId: number, clockInPhoto: string): Promise<boolean> {
  // Get user's reference photo
  const referencePhoto = await this.getUserReferencePhoto(userId);

  // Compare using face recognition API
  const similarity = await this.faceRecognitionService.compare(
    referencePhoto,
    clockInPhoto
  );

  return similarity >= 0.9; // 90% match threshold
}
```

### 6.3 Privacy & Compliance

**GDPR/Privacy Considerations:**
- [ ] Obtain user consent for photo capture
- [ ] Store photos securely with encryption
- [ ] Provide data export option (user can download their photos)
- [ ] Implement right to deletion
- [ ] Access logs for who viewed attendance photos

---

## 7. Reporting & Scoring System

### 7.1 Scoring Algorithm

**Component Weights:**
```
Total Score = (Attendance × 0.4) + (Punctuality × 0.3) +
              (Working Hours × 0.2) + (Leave Utilization × 0.1)
```

**Component Calculations:**

**1. Attendance Score (40%):**
```
Score = (Present Days / Total Working Days) × 100
Example: 22 present / 24 working days = 91.67%
```

**2. Punctuality Score (30%):**
```
Score = ((Present Days - Late Arrivals) / Present Days) × 100
Example: (22 - 3) / 22 = 86.36%
```

**3. Working Hours Score (20%):**
```
Expected Hours = Total Working Days × 8 hours/day
Score = (Actual Hours / Expected Hours) × 100
Capped at 100 (overtime doesn't exceed score)
Example: 178 hours / (24 × 8) = 92.71%
```

**4. Leave Utilization Score (10%):**
```
Optimal leave usage = 40-60% of annual quota
Score calculation:
- Used < 40%: Score = (Used / 40%) × 100 (encourages work-life balance)
- Used 40-60%: Score = 100 (optimal)
- Used > 60%: Score = 100 - ((Used - 60%) × 2) (penalizes excessive leaves)
```

**Grading Scale:**
```
95-100: A+  (Outstanding)
90-94:  A   (Excellent)
85-89:  B+  (Very Good)
80-84:  B   (Good)
75-79:  C+  (Above Average)
70-74:  C   (Average)
60-69:  D   (Below Average)
<60:    F   (Needs Improvement)
```

### 7.2 Report Types

**1. Individual Score Card**
```json
{
  "userId": 5,
  "userName": "John Doe",
  "period": "2025-11",
  "totalScore": 87.5,
  "grade": "B+",
  "rank": 8,
  "totalEmployees": 45,
  "components": {
    "attendance": { "score": 91.67, "presentDays": 22, "workingDays": 24 },
    "punctuality": { "score": 86.36, "lateArrivals": 3, "presentDays": 22 },
    "workingHours": { "score": 92.71, "actualHours": 178, "expectedHours": 192 },
    "leaveUtilization": { "score": 100, "used": 2, "available": 15 }
  },
  "improvement": "+5.2% from last month"
}
```

**2. Team Leaderboard**
```json
[
  { "rank": 1, "userId": 12, "name": "Alice Smith", "score": 95.8, "grade": "A+" },
  { "rank": 2, "userId": 7, "name": "Bob Johnson", "score": 92.3, "grade": "A" },
  { "rank": 3, "userId": 15, "name": "Carol Williams", "score": 89.1, "grade": "B+" }
  // ...
]
```

**3. Attendance Summary Report**
```json
{
  "period": "2025-11",
  "totalEmployees": 45,
  "totalWorkingDays": 24,
  "statistics": {
    "avgAttendanceRate": 91.5,
    "avgPunctuality": 88.2,
    "totalLateArrivals": 87,
    "totalEarlyDepartures": 23,
    "totalLeavesTaken": 45.5,
    "avgWorkingHours": 182.4
  },
  "trends": {
    "attendanceImprovement": "+2.3%",
    "punctualityChange": "-1.1%"
  }
}
```

### 7.3 Automated Score Calculation

**Cron Job (NestJS Schedule):**
```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ScoreCalculationScheduler {
  constructor(private hrReportService: HrReportService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyScores() {
    console.log('Starting daily score calculation...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await this.hrReportService.calculateAllUsersScores(
      yesterday.getFullYear(),
      yesterday.getMonth() + 1
    );

    console.log('Daily score calculation completed');
  }

  @Cron('0 0 1 * *') // 1st day of every month at midnight
  async calculateMonthlyScores() {
    console.log('Starting monthly score calculation...');
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    await this.hrReportService.calculateAllUsersScores(
      lastMonth.getFullYear(),
      lastMonth.getMonth() + 1
    );

    console.log('Monthly score calculation completed');
  }
}
```

---

## 8. Security & Privacy

### 8.1 Access Control

**Role-Based Permissions:**

**Employee:**
- Clock in/out (own)
- View own attendance
- Apply for leave
- View own leave balance
- View own performance score

**Manager/Store Head:**
- All employee permissions
- View team attendance
- Approve/reject leave requests
- View team performance reports
- Assign shifts to team members

**Admin:**
- All permissions
- Manage shifts
- Manage leave types
- View all reports
- Manual attendance entry/correction
- Access all attendance photos

**Permission Configuration (app_role):**
```json
{
  "resource": "hr",
  "path": "/secure/hr",
  "policies": [
    {
      "action": "clock-in",
      "path": "/attendance/clock-in",
      "properties": []
    },
    {
      "action": "view-team-attendance",
      "path": "/attendance/team",
      "properties": [],
      "roles": ["Admin", "Store Head"]
    },
    {
      "action": "approve-leaves",
      "path": "/leaves/approve",
      "properties": [],
      "roles": ["Admin", "Store Head"]
    }
  ]
}
```

### 8.2 Data Protection

**Photo Storage:**
- Encrypt photos at rest (AES-256)
- Secure file permissions (read-only for application)
- No direct URL access (serve through authenticated endpoint)
- Watermark photos with timestamp and user ID

**Attendance Data:**
- Encrypt sensitive fields (IP address, device info)
- Access logging for audit trail
- Data retention policy (configurable)
- Export capability for compliance

**API Security:**
- Rate limiting on clock-in/out endpoints (prevent abuse)
- IP whitelisting for office locations (optional)
- Device fingerprinting to detect anomalies

---

## 9. Implementation Phases

### Phase 1: Database & Backend Foundation (Week 1-2)
**Tasks:**
- [ ] Create database migration scripts for all tables
- [ ] Create TypeORM entities
- [ ] Set up HR module structure
- [ ] Implement Shift service and controller
- [ ] Implement basic Attendance service (without webcam)
- [ ] Unit tests for services

**Deliverables:**
- All database tables created
- Shift management API functional
- Basic attendance CRUD API

### Phase 2: Attendance with Webcam (Week 3)
**Tasks:**
- [ ] Implement file upload for webcam photos
- [ ] Clock-in/out service with photo storage
- [ ] IP and device tracking
- [ ] Lateness and early departure calculation
- [ ] Integration tests

**Deliverables:**
- Clock-in/out API with photo capture
- Photo storage system
- Attendance calculation logic

### Phase 3: Leave Management (Week 4)
**Tasks:**
- [ ] Leave type master setup
- [ ] Leave request service
- [ ] Leave approval workflow
- [ ] Leave balance tracking
- [ ] Integration with attendance (mark as ON_LEAVE)

**Deliverables:**
- Leave application API
- Leave approval API
- Leave balance system

### Phase 4: Reporting & Scoring (Week 5)
**Tasks:**
- [ ] Implement scoring algorithm
- [ ] User score calculation service
- [ ] Automated score calculation (cron jobs)
- [ ] Report generation APIs
- [ ] Leaderboard API

**Deliverables:**
- Performance scoring system
- Report APIs
- Automated calculations

### Phase 5: Frontend Implementation (Week 6-8)
**Tasks:**
- [ ] Angular HR module setup
- [ ] Clock-in/out pages with webcam
- [ ] My attendance page
- [ ] Leave application form
- [ ] Leave approval interface (manager)
- [ ] My score dashboard
- [ ] Team reports (manager/admin)
- [ ] Shift management UI (admin)

**Deliverables:**
- Complete frontend for all features
- Responsive design
- User-friendly interface

### Phase 6: Testing & Deployment (Week 9)
**Tasks:**
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Security audit
- [ ] User acceptance testing
- [ ] Documentation
- [ ] Deployment

**Deliverables:**
- Tested and production-ready system
- User documentation
- Admin guide

---

## 10. Effort Estimation

### Development Effort

| Phase | Component | Estimated Hours | Developer |
|-------|-----------|----------------|-----------|
| 1 | Database schema & migrations | 16 | Backend Dev |
| 1 | TypeORM entities | 12 | Backend Dev |
| 1 | Shift management (Service + Controller) | 20 | Backend Dev |
| 1 | Basic Attendance (Service + Controller) | 16 | Backend Dev |
| 2 | Webcam photo storage | 12 | Backend Dev |
| 2 | Clock-in/out with calculations | 24 | Backend Dev |
| 3 | Leave management (Service + Controller) | 32 | Backend Dev |
| 3 | Leave balance tracking | 16 | Backend Dev |
| 4 | Scoring algorithm implementation | 20 | Backend Dev |
| 4 | Report services | 24 | Backend Dev |
| 4 | Cron jobs for automation | 8 | Backend Dev |
| 5 | Frontend Angular modules | 40 | Frontend Dev |
| 5 | Webcam integration (ngx-webcam) | 16 | Frontend Dev |
| 5 | All HR pages and components | 56 | Frontend Dev |
| 5 | Dashboards and widgets | 24 | Frontend Dev |
| 6 | Testing (Unit + Integration + E2E) | 32 | QA/Dev |
| 6 | Documentation | 16 | Tech Writer/Dev |
| | **Total** | **384 hours** | **~9-10 weeks** |

### Resource Requirements

**Team:**
- 1 Backend Developer (NestJS/TypeORM)
- 1 Frontend Developer (Angular)
- 1 QA Engineer (part-time)
- 1 Tech Writer/BA (part-time)

**Infrastructure:**
- File storage (200GB for photos)
- Automated backup for attendance photos
- (Optional) Face recognition API credits

---

## 11. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Photo storage filling up disk | High | Implement automated cleanup, compression, cloud archival |
| Privacy concerns with photos | High | Encryption, access controls, consent forms, GDPR compliance |
| Timezone issues | Medium | Store all times in UTC, display in user timezone |
| Network issues during clock-in | Medium | Offline queue support, retry mechanism |
| Buddy punching (fraud) | Medium | Face verification (Phase 2), IP restrictions, anomaly detection |
| Performance with large photo storage | Medium | CDN for photos, lazy loading, pagination |
| Shift overlap conflicts | Low | Validation in service layer, clear error messages |
| Leave balance calculation errors | Low | Transaction wrappers, comprehensive tests |

---

## 12. Future Enhancements

### Phase 7+ (Optional)
1. **Geofencing**: Restrict clock-in to office location (GPS)
2. **Face Recognition**: Automatic identity verification
3. **Mobile App**: Native iOS/Android apps for clock-in
4. **Biometric Integration**: Fingerprint/face ID on mobile
5. **Overtime Tracking**: Automatic overtime calculation and approval
6. **Payroll Integration**: Export attendance data for payroll
7. **Notifications**: Email/SMS for late arrivals, leave approvals
8. **Analytics Dashboard**: Advanced insights, trends, predictions
9. **Shift Swapping**: Allow employees to swap shifts with approval
10. **Break Tracking**: Clock-in/out for breaks

---

## 13. Success Metrics

**KPIs to Track:**
- [ ] Clock-in/out adoption rate (target: 100% within 1 month)
- [ ] Average clock-in time accuracy (target: ±2 minutes)
- [ ] Leave request processing time (target: <24 hours)
- [ ] User satisfaction score (target: 4+/5)
- [ ] System uptime (target: 99.9%)
- [ ] Photo storage usage trend
- [ ] Report generation performance (<3 seconds)

---

## 14. Conclusion

This proposal provides a comprehensive HR management system that integrates seamlessly with the existing RGP Back Office architecture. The features leverage:

- ✅ Existing BaseEntity patterns
- ✅ Transaction support for data integrity
- ✅ Role-based access control
- ✅ Global error handling
- ✅ File upload infrastructure
- ✅ Swagger API documentation

**Next Steps:**
1. Review and approve this proposal
2. Clarify any requirements or modifications
3. Set up development environment
4. Begin Phase 1 implementation

---

**Prepared by:** Claude Code
**Date:** 2025-11-30
**Estimated Timeline:** 9-10 weeks
**Estimated Effort:** 384 hours
**Status:** Pending Approval
