import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PayrollDetail } from './payroll-detail.entity';

@Entity('payroll_run')
export class PayrollRun {
  @PrimaryGeneratedColumn()
  id: number;

  // Period
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'date', name: 'period_start_date' })
  periodStartDate: Date;

  @Column({ type: 'date', name: 'period_end_date' })
  periodEndDate: Date;

  // Metadata
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Status
  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string; // DRAFT, CALCULATED, APPROVED, PAYMENT_REQUESTED, PAYMENT_PROCESSING, COMPLETED, CANCELLED

  // Calculation Summary
  @Column({ type: 'int', default: 0, name: 'total_employees' })
  totalEmployees: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_gross_salary' })
  totalGrossSalary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_deductions' })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_net_salary' })
  totalNetSalary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, name: 'total_employer_contributions' })
  totalEmployerContributions: number;

  // Workflow
  @Column({ type: 'timestamptz', nullable: true, name: 'calculated_on' })
  calculatedOn: Date | null;

  @Column({ type: 'int', nullable: true, name: 'calculated_by' })
  calculatedBy: number | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_on' })
  approvedOn: Date | null;

  @Column({ type: 'int', nullable: true, name: 'approved_by' })
  approvedBy: number | null;

  @Column({ type: 'text', nullable: true, name: 'approval_remarks' })
  approvalRemarks: string | null;

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
  createdBy: number | null;

  @Column({ type: 'int', nullable: true, name: 'updated_by' })
  updatedBy: number | null;

  // Relations
  @OneToMany(() => PayrollDetail, detail => detail.payrollRun)
  details: PayrollDetail[];
}
