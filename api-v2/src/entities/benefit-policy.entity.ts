import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { AppUser } from './appuser.entity';
import { BenefitMaster } from './benefit-master.entity';
import { EmployeeBenefitEnrollment } from './employee-benefit-enrollment.entity';
import { BenefitClaim } from './benefit-claim.entity';

/**
 * Benefit Policy Entity
 * Specific configurations for benefit plans
 */
@Entity('benefit_policy')
@Index(['benefitId'])
@Index(['effectiveFrom', 'effectiveTo'], { where: 'active = true' })
@Index(['active', 'archive'])
export class BenefitPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'benefit_id' })
  benefitId: number;

  @ManyToOne(() => BenefitMaster, (benefit) => benefit.policies)
  @JoinColumn({ name: 'benefit_id' })
  benefit: BenefitMaster;

  @Column({ type: 'varchar', length: 100, name: 'policy_name' })
  policyName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Coverage Configuration
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'coverage_amount',
  })
  coverageAmount: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'coverage_percentage',
  })
  coveragePercentage: number;

  @Column({ type: 'jsonb', nullable: true, name: 'coverage_formula' })
  coverageFormula: Record<string, any>;

  // Cost Configuration
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'employee_contribution_amount',
  })
  employeeContributionAmount: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'employee_contribution_percentage',
  })
  employeeContributionPercentage: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'employer_contribution_amount',
  })
  employerContributionAmount: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'employer_contribution_percentage',
  })
  employerContributionPercentage: number;

  // Family Coverage
  @Column({
    type: 'boolean',
    default: false,
    name: 'family_coverage_allowed',
  })
  familyCoverageAllowed: boolean;

  @Column({ type: 'int', default: 0, name: 'max_dependents' })
  maxDependents: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'dependent_coverage_amount',
  })
  dependentCoverageAmount: number;

  // Policy Details
  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'policy_provider',
  })
  policyProvider: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'policy_number',
  })
  policyNumber: string;

  @Column({ type: 'date', nullable: true, name: 'policy_start_date' })
  policyStartDate: Date;

  @Column({ type: 'date', nullable: true, name: 'policy_end_date' })
  policyEndDate: Date;

  @Column({ type: 'date', nullable: true, name: 'renewal_date' })
  renewalDate: Date;

  // Rules & Conditions
  @Column({ type: 'int', default: 0, name: 'waiting_period_days' })
  waitingPeriodDays: number;

  @Column({
    type: 'int',
    default: 30,
    name: 'claim_submission_deadline_days',
  })
  claimSubmissionDeadlineDays: number;

  @Column({ type: 'int', nullable: true, name: 'max_claims_per_year' })
  maxClaimsPerYear: number;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'documents_required',
  })
  documentsRequired: string[];

  @Column({ type: 'text', nullable: true, name: 'terms_and_conditions' })
  termsAndConditions: string;

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

  // Relationships
  @OneToMany(() => EmployeeBenefitEnrollment, (enrollment) => enrollment.benefitPolicy)
  enrollments: EmployeeBenefitEnrollment[];

  @OneToMany(() => BenefitClaim, (claim) => claim.benefitPolicy)
  claims: BenefitClaim[];

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: AppUser;

  @Column({ type: 'int', nullable: true, name: 'created_by' })
  createdBy: number;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: AppUser;

  @Column({ type: 'int', nullable: true, name: 'updated_by' })
  updatedBy: number;

  // Audit columns
  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_on' })
  updatedOn: Date;
}
