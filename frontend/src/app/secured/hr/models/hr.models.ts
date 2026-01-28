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

// ==============================================================================
// HR POLICY & BENEFITS MODELS
// ==============================================================================

// Policy & Benefits Enums
export enum PolicyCategory {
  EMPLOYMENT = 'EMPLOYMENT',
  COMPENSATION = 'COMPENSATION',
  ATTENDANCE = 'ATTENDANCE',
  CONDUCT = 'CONDUCT',
  BENEFITS = 'BENEFITS',
  LEAVE = 'LEAVE',
  PERFORMANCE = 'PERFORMANCE',
  SAFETY = 'SAFETY',
  OTHER = 'OTHER'
}

export enum BenefitCategory {
  INSURANCE = 'INSURANCE',
  STATUTORY = 'STATUTORY',
  ALLOWANCE = 'ALLOWANCE',
  WELLNESS = 'WELLNESS',
  EDUCATION = 'EDUCATION',
  RETIREMENT = 'RETIREMENT',
  OTHER = 'OTHER'
}

export enum EnrollmentType {
  AUTO = 'AUTO',
  VOLUNTARY = 'VOLUNTARY',
  MANDATORY = 'MANDATORY'
}

export enum EnrollmentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum ClaimType {
  REIMBURSEMENT = 'REIMBURSEMENT',
  DIRECT_BILLING = 'DIRECT_BILLING',
  CASHLESS = 'CASHLESS'
}

export enum ClaimStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID'
}

export enum PaymentMode {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
  PAYROLL = 'PAYROLL'
}

// HR Policy Models
export interface HrPolicyMaster {
  id: number;
  policyCode: string;
  policyName: string;
  policyCategory: PolicyCategory;
  description: string | null;
  policyContent: Record<string, any>;
  version: number;
  isMandatory: boolean;
  requiresAcknowledgment: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  active: boolean;
  archive: boolean;
  createdBy: number;
  updatedBy: number;
  createdOn: Date;
  updatedOn: Date;
  // Optional - populated when retrieving user-specific policies
  acknowledgedOn?: Date | null;
}

export interface HrPolicyAcknowledgment {
  id: number;
  policyId: number;
  userId: number;
  acknowledgedOn: Date;
  policyVersion: number;
  policyContentSnapshot: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  policy?: HrPolicyMaster;
  user?: any;
}

export interface CreateHrPolicyDto {
  policyCode: string;
  policyName: string;
  policyCategory: PolicyCategory;
  description?: string;
  policyContent: Record<string, any>;
  isMandatory?: boolean;
  requiresAcknowledgment?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateHrPolicyDto {
  policyName?: string;
  policyCategory?: PolicyCategory;
  description?: string;
  policyContent?: Record<string, any>;
  isMandatory?: boolean;
  requiresAcknowledgment?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  active?: boolean;
}

export interface AcknowledgePolicyDto {
  ipAddress?: string;
  userAgent?: string;
}

// Benefit Models
export interface BenefitMaster {
  id: number;
  benefitCode: string;
  benefitName: string;
  benefitCategory: BenefitCategory;
  description: string | null;
  isTaxable: boolean;
  active: boolean;
  archive: boolean;
  createdBy: number;
  updatedBy: number;
  createdOn: Date;
  updatedOn: Date;
}

export interface BenefitPolicy {
  id: number;
  benefitId: number;
  policyName: string;
  description: string | null;
  coverageAmount: number | null;
  coveragePercentage: number | null;
  coverageFormula: Record<string, any> | null;
  employeeContributionAmount: number;
  employeeContributionPercentage: number;
  employerContributionAmount: number;
  employerContributionPercentage: number;
  familyCoverageAllowed: boolean;
  maxDependents: number;
  dependentCoverageAmount: number | null;
  policyProvider: string | null;
  policyNumber: string | null;
  policyStartDate: Date | null;
  policyEndDate: Date | null;
  renewalDate: Date | null;
  waitingPeriodDays: number;
  claimSubmissionDeadlineDays: number;
  maxClaimsPerYear: number | null;
  documentsRequired: string[] | null;
  termsAndConditions: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  active: boolean;
  archive: boolean;
  benefit?: BenefitMaster;
  createdBy: number;
  updatedBy: number;
  createdOn: Date;
  updatedOn: Date;
}

export interface CreateBenefitMasterDto {
  benefitCode: string;
  benefitName: string;
  benefitCategory: BenefitCategory;
  description?: string;
  isTaxable?: boolean;
}

export interface CreateBenefitPolicyDto {
  benefitId: number;
  policyName: string;
  description?: string;
  coverageAmount?: number;
  coveragePercentage?: number;
  coverageFormula?: Record<string, any>;
  employeeContributionAmount?: number;
  employeeContributionPercentage?: number;
  employerContributionAmount?: number;
  employerContributionPercentage?: number;
  familyCoverageAllowed?: boolean;
  maxDependents?: number;
  dependentCoverageAmount?: number;
  policyProvider?: string;
  policyNumber?: string;
  policyStartDate?: string;
  policyEndDate?: string;
  renewalDate?: string;
  waitingPeriodDays?: number;
  claimSubmissionDeadlineDays?: number;
  maxClaimsPerYear?: number;
  documentsRequired?: string[];
  termsAndConditions?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateBenefitPolicyDto {
  policyName?: string;
  description?: string;
  coverageAmount?: number;
  coveragePercentage?: number;
  employeeContributionAmount?: number;
  familyCoverageAllowed?: boolean;
  maxDependents?: number;
  effectiveTo?: string;
  active?: boolean;
}

// Enrollment Models
export interface EmployeeBenefitEnrollment {
  id: number;
  userId: number;
  benefitPolicyId: number;
  enrollmentDate: Date;
  enrollmentType: EnrollmentType;
  status: EnrollmentStatus;
  customCoverageAmount: number | null;
  customEmployeeContribution: number | null;
  dependents: Record<string, any> | null;
  nomineeName: string | null;
  nomineeRelationship: string | null;
  nomineeDob: Date | null;
  nomineeContact: string | null;
  nomineePercentage: number;
  requiresApproval: boolean;
  approvedBy: number | null;
  approvedOn: Date | null;
  approvalRemarks: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  cancellationDate: Date | null;
  cancellationReason: string | null;
  active: boolean;
  benefitPolicy?: BenefitPolicy;
  user?: any;
  createdBy: number;
  updatedBy: number;
  createdOn: Date;
  updatedOn: Date;
}

export interface CreateEnrollmentDto {
  benefitPolicyId: number;
  enrollmentType?: EnrollmentType;
  customCoverageAmount?: number;
  customEmployeeContribution?: number;
  dependents?: Record<string, any>;
  nomineeName?: string;
  nomineeRelationship?: string;
  nomineeDob?: string;
  nomineeContact?: string;
  nomineePercentage?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateEnrollmentDto {
  customCoverageAmount?: number;
  customEmployeeContribution?: number;
  dependents?: Record<string, any>;
  nomineeName?: string;
  nomineeRelationship?: string;
  nomineeDob?: string;
  nomineeContact?: string;
  nomineePercentage?: number;
}

export interface ApproveEnrollmentDto {
  approved: boolean;
  remarks?: string;
}

export interface BulkEnrollmentDto {
  benefitPolicyId: number;
  userIds: number[];
  enrollmentType?: EnrollmentType;
}

// Claim Models
export interface BenefitClaim {
  id: number;
  claimNumber: string;
  userId: number;
  enrollmentId: number;
  benefitPolicyId: number;
  claimType: ClaimType;
  claimDate: Date;
  incidentDate: Date | null;
  claimedAmount: number;
  approvedAmount: number | null;
  rejectedAmount: number | null;
  paidAmount: number | null;
  description: string;
  documents: Record<string, any> | null;
  status: ClaimStatus;
  reviewedBy: number | null;
  reviewedOn: Date | null;
  reviewerRemarks: string | null;
  approvedBy: number | null;
  approvedOn: Date | null;
  approvalRemarks: string | null;
  rejectionReason: string | null;
  paymentMode: PaymentMode | null;
  paymentReference: string | null;
  paymentDate: Date | null;
  payrollRunId: number | null;
  benefitPolicy?: BenefitPolicy;
  enrollment?: EmployeeBenefitEnrollment;
  user?: any;
  createdBy: number;
  updatedBy: number;
  createdOn: Date;
  updatedOn: Date;
}

export interface SubmitClaimDto {
  enrollmentId: number;
  benefitPolicyId: number;
  claimType: ClaimType;
  claimedAmount: number;
  incidentDate?: string;
  description: string;
  documents?: Record<string, any>;
}

export interface ReviewClaimDto {
  approvedAmount?: number;
  rejectedAmount?: number;
  reviewerRemarks?: string;
}

export interface ApproveClaimDto {
  approvedAmount: number;
  approvalRemarks?: string;
}

export interface RejectClaimDto {
  rejectionReason: string;
}

export interface PayClaimDto {
  paymentMode: PaymentMode;
  paymentReference?: string;
  paymentDate: string;
  payrollRunId?: number;
}
