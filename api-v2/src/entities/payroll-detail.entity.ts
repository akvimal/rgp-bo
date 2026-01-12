import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AppUser } from './appuser.entity';
import { PayrollRun } from './payroll-run.entity';
import { EmploymentTypeMaster } from './employment-type-master.entity';
import { RoleMaster } from './role-master.entity';

@Entity('payroll_detail')
export class PayrollDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'payroll_run_id' })
  payrollRunId: number;

  @ManyToOne(() => PayrollRun, payrollRun => payrollRun.details)
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRun;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  // Employment Configuration (snapshot)
  @Column({ type: 'varchar', length: 20, name: 'employment_type_code' })
  employmentTypeCode: string;

  @ManyToOne(() => EmploymentTypeMaster)
  @JoinColumn({ name: 'employment_type_code', referencedColumnName: 'code' })
  employmentType: EmploymentTypeMaster;

  @Column({ type: 'varchar', length: 20, name: 'role_code' })
  roleCode: string;

  @ManyToOne(() => RoleMaster)
  @JoinColumn({ name: 'role_code', referencedColumnName: 'code' })
  role: RoleMaster;

  @Column({ type: 'varchar', length: 20, name: 'payment_model' })
  paymentModel: string;

  // Period
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  // Attendance/Work Summary
  @Column({ type: 'int', nullable: true, name: 'total_working_days' })
  totalWorkingDays: number;

  @Column({ type: 'int', nullable: true, name: 'actual_days_worked' })
  actualDaysWorked: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'present_days' })
  presentDays: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'paid_leave_days' })
  paidLeaveDays: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'lwp_days' })
  lwpDays: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'hours_worked' })
  hoursWorked: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'billable_hours' })
  billableHours: number;

  // Earnings Breakdown (JSON)
  @Column({ type: 'jsonb', default: {}, name: 'earnings_breakdown' })
  earningsBreakdown: Record<string, number>;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'gross_salary' })
  grossSalary: number;

  // Deductions Breakdown (JSON)
  @Column({ type: 'jsonb', default: {}, name: 'deductions_breakdown' })
  deductionsBreakdown: Record<string, number>;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_deductions' })
  totalDeductions: number;

  // Employer Contributions (JSON)
  @Column({ type: 'jsonb', default: {}, name: 'employer_contributions' })
  employerContributions: Record<string, number>;

  // Net Salary
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'net_salary' })
  netSalary: number;

  // KPI Details
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'kpi_score' })
  kpiScore: number;

  @Column({ type: 'jsonb', nullable: true, name: 'kpi_breakdown' })
  kpiBreakdown: Record<string, number>;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'kpi_incentive_amount' })
  kpiIncentiveAmount: number;

  // Payment Status
  @Column({ type: 'varchar', length: 20, default: 'PENDING', name: 'payment_status' })
  paymentStatus: string; // PENDING, REQUESTED, APPROVED, PROCESSING, PAID, FAILED, ON_HOLD

  @Column({ type: 'date', nullable: true, name: 'payment_date' })
  paymentDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'payment_reference' })
  paymentReference: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'payment_method' })
  paymentMethod: string; // BANK_TRANSFER, CASH, CHEQUE, UPI

  @Column({ type: 'int', nullable: true, name: 'payment_transaction_id' })
  paymentTransactionId: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'jsonb', nullable: true, name: 'calculation_metadata' })
  calculationMetadata: any;

  // Audit
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  archive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_on' })
  updatedOn: Date;

  @Column({ type: 'int', nullable: true, name: 'created_by' })
  createdBy: number;

  @Column({ type: 'int', nullable: true, name: 'updated_by' })
  updatedBy: number;
}
