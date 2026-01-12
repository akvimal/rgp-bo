// Enums
export enum AttendanceStatus {
  PENDING = 'PENDING',
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
  REMOTE_WORK = 'REMOTE_WORK',
  BUSINESS_TRAVEL = 'BUSINESS_TRAVEL',
  PUBLIC_HOLIDAY = 'PUBLIC_HOLIDAY'
}

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum ScorePeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export enum ScoreGrade {
  A_PLUS = 'A+',
  A = 'A',
  B_PLUS = 'B+',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F'
}

// Shift Models
export interface Shift {
  id: number;
  name: string;
  storeid: number;
  starttime: string;
  endtime: string;
  breakduration: number;
  graceperiodminutes?: number;
  description?: string;
  active: boolean;
  archive: boolean;
  createdon?: Date;
  updatedon?: Date;
}

export interface UserShift {
  id: number;
  userId: number;
  shiftId: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  daysOfWeek: number[];
  isActive: boolean;
  shift?: Shift;
}

// Attendance Models
export interface Attendance {
  id: number;
  userid: number;
  attendancedate: Date;
  shiftid: number | null;
  clockintime: Date | null;
  clockouttime: Date | null;
  clockinphotourl: string | null;
  clockoutphotourl: string | null;
  totalhours: number | null;
  status: AttendanceStatus;
  remarks: string | null;
  warning?: string; // Optional warning message from backend
  shift?: Shift;
  user?: any;
}

export interface ClockInDto {
  photo?: File;
}

export interface ClockOutDto {
  photo?: File;
}

// Leave Models
export interface LeaveType {
  id: number;
  name: string;
  description: string | null;
  isPaid: boolean;
  isActive: boolean;
  maxDaysPerYear: number | null;
  requiresApproval: boolean;
  allowCarryForward: boolean;
}

export interface LeaveRequest {
  id: number;
  userId: number;
  leaveTypeId: number;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  status: LeaveRequestStatus;
  approvedBy: number | null;
  approvalDate: Date | null;
  approvalComments: string | null;
  isFirstHalfDay: boolean;
  isLastHalfDay: boolean;
  attachmentUrl: string | null;
  createdAt?: Date;
  leaveType?: LeaveType;
  user?: any;
  approver?: any;
}

export interface LeaveBalance {
  id: number;
  userId: number;
  leaveTypeId: number;
  year: number;
  totalDays: number;
  usedDays: number;
  availableDays: number;
  carriedOverDays: number;
  leaveType?: LeaveType;
}

// Performance Models
export interface UserScore {
  id: number;
  userId: number;
  scoreDate: Date;
  scorePeriod: ScorePeriod;
  attendanceScore: number;
  punctualityScore: number;
  reliabilityScore: number;
  totalScore: number;
  grade: ScoreGrade | null;
  scoreDetails: any;
  user?: any;
}

export interface ScoreComponents {
  attendanceScore: number;
  punctualityScore: number;
  reliabilityScore: number;
}

// Report Models
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

export interface UserDashboard {
  today: {
    clockedIn: boolean;
    clockedOut: boolean;
    clockInTime: string | null;
    clockOutTime: string | null;
    status: string;
  };
  currentMonth: {
    presentDays: number;
    totalScore: number;
    grade: string;
    rank: number;
  };
  pendingActions: {
    pendingLeaveRequests: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  userName: string;
  totalScore: number;
  grade: string;
}
