export interface PayrollRun {
  id: number;
  year: number;
  month: number;
  periodStartDate: string;
  periodEndDate: string;
  title: string;
  description: string | null;
  status: PayrollStatus;
  totalEmployees: number;
  totalGrossSalary: string;
  totalDeductions: string;
  totalNetSalary: string;
  totalEmployerContributions: string;
  calculatedOn: string | null;
  calculatedBy: number | null;
  approvedOn: string | null;
  approvedBy: number | null;
  approvalRemarks: string | null;
  active: boolean;
  archive: boolean;
  createdOn: string;
  updatedOn: string;
  createdBy: number | null;
  updatedBy: number | null;
}

export interface PayrollRunWithDetails extends PayrollRun {
  details: PayrollDetail[];
}

export interface PayrollDetail {
  id: number;
  payrollRunId: number;
  userId: number;
  user: EmployeeUser;
  employmentTypeCode: string;
  roleCode: string;
  paymentModel: PaymentModel;
  year: number;
  month: number;
  totalWorkingDays: number | null;
  actualDaysWorked: number;
  presentDays: string | null;
  paidLeaveDays: string | null;
  lwpDays: string | null;
  hoursWorked: string | null;
  billableHours: string | null;
  earningsBreakdown: Record<string, number>;
  grossSalary: string;
  deductionsBreakdown: Record<string, number>;
  totalDeductions: string;
  employerContributions: Record<string, number>;
  netSalary: string;
  kpiScore: string;
  kpiBreakdown: Record<string, number>;
  kpiIncentiveAmount: string;
  paymentStatus: PaymentStatus;
  paymentDate: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  paymentTransactionId: number | null;
  remarks: string | null;
  calculationMetadata: any;
  active: boolean;
  archive: boolean;
  createdOn: string;
  updatedOn: string;
  createdBy: number;
  updatedBy: number;
}

export interface EmployeeUser {
  id: number;
  email: string;
  fullname: string;
  phone: string;
  roleid: number;
}

export interface CreatePayrollRunDto {
  year: number;
  month: number;
  title: string;
  description?: string;
}

export interface CalculatePayrollDto {
  payrollRunId: number;
  userIds?: number[];
}

export interface CalculatePayrollResponse {
  payrollRunId: number;
  status: string;
  totalEmployees: number;
  totalGrossSalary: number;
  totalDeductions: number;
  totalNetSalary: number;
  totalEmployerContributions: number;
  successCount: number;
  errorCount: number;
}

export type PayrollStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'APPROVED'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentModel =
  | 'MONTHLY_FIXED'
  | 'RETAINER_PLUS_PERDAY'
  | 'HOURLY'
  | 'PROJECT_BASED'
  | 'DAILY_WAGE';

export type PaymentStatus =
  | 'PENDING'
  | 'REQUESTED'
  | 'APPROVED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'ON_HOLD';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
