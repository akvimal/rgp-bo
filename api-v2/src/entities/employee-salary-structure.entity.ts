import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AppUser } from './appuser.entity';
import { EmploymentTypeMaster } from './employment-type-master.entity';
import { RoleMaster } from './role-master.entity';

@Entity('employee_salary_structure')
export class EmployeeSalaryStructure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  // Employment Configuration
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

  // Payment Model Configuration
  @Column({ type: 'varchar', length: 20, name: 'payment_model' })
  paymentModel: string;

  // For MONTHLY_FIXED
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'monthly_fixed_ctc' })
  monthlyFixedCtc: number;

  // For RETAINER_PLUS_PERDAY
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'monthly_retainer' })
  monthlyRetainer: number;

  @Column({ type: 'int', default: 0, name: 'included_days' })
  includedDays: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'per_day_rate' })
  perDayRate: number;

  // For HOURLY
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'hourly_rate' })
  hourlyRate: number;

  // For PROJECT_BASED
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'project_rate' })
  projectRate: number;

  // Component-wise Breakdown (JSON)
  @Column({ type: 'jsonb', default: {}, name: 'salary_components' })
  salaryComponents: Record<string, number>;

  // KPI Configuration
  @Column({ type: 'boolean', default: true, name: 'kpi_eligible' })
  kpiEligible: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'max_kpi_incentive' })
  maxKpiIncentive: number;

  @Column({ type: 'jsonb', name: 'kpi_payout_bands' })
  kpiPayoutBands: Record<string, number>;

  // Statutory Configuration
  @Column({ type: 'boolean', nullable: true, name: 'pf_applicable' })
  pfApplicable: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'pf_number' })
  pfNumber: string;

  @Column({ type: 'boolean', nullable: true, name: 'esi_applicable' })
  esiApplicable: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'esi_number' })
  esiNumber: string;

  @Column({ type: 'boolean', nullable: true, name: 'pt_applicable' })
  ptApplicable: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'tds_applicable' })
  tdsApplicable: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'pan_number' })
  panNumber: string;

  // Statutory Percentages
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 12, name: 'pf_employee_percentage' })
  pfEmployeePercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 12, name: 'pf_employer_percentage' })
  pfEmployerPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.75, name: 'esi_employee_percentage' })
  esiEmployeePercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 3.25, name: 'esi_employer_percentage' })
  esiEmployerPercentage: number;

  // Benefits
  @Column({ type: 'boolean', default: false, name: 'insurance_reimbursement_eligible' })
  insuranceReimbursementEligible: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1000, name: 'annual_insurance_limit' })
  annualInsuranceLimit: number;

  // Bank Details
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bank_name' })
  bankName: string;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'account_number' })
  accountNumber: string;

  @Column({ type: 'varchar', length: 15, nullable: true, name: 'ifsc_code' })
  ifscCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'account_holder_name' })
  accountHolderName: string;

  // Effective Dates
  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom: Date;

  @Column({ type: 'date', nullable: true, name: 'effective_to' })
  effectiveTo: Date;

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
