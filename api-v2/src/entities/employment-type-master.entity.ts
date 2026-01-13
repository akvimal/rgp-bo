import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('employment_type_master')
export class EmploymentTypeMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20, name: 'payment_model' })
  paymentModel: string; // MONTHLY_FIXED, RETAINER_PLUS_PERDAY, HOURLY, PROJECT_BASED, DAILY_WAGE

  // Statutory Applicability
  @Column({ type: 'boolean', default: false, name: 'pf_applicable' })
  pfApplicable: boolean;

  @Column({ type: 'boolean', default: false, name: 'esi_applicable' })
  esiApplicable: boolean;

  @Column({ type: 'boolean', default: false, name: 'pt_applicable' })
  ptApplicable: boolean;

  @Column({ type: 'boolean', default: false, name: 'tds_applicable' })
  tdsApplicable: boolean;

  @Column({ type: 'boolean', default: false, name: 'gratuity_applicable' })
  gratuityApplicable: boolean;

  @Column({ type: 'boolean', default: false, name: 'leave_entitled' })
  leaveEntitled: boolean;

  @Column({ type: 'boolean', default: false, name: 'bonus_entitled' })
  bonusEntitled: boolean;

  // Default Configurations
  @Column({ type: 'int', default: 26, name: 'default_working_days_per_month' })
  defaultWorkingDaysPerMonth: number;

  @Column({ type: 'int', default: 30, name: 'notice_period_days' })
  noticePeriodDays: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;
}
