import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  OneToMany,
} from 'typeorm';
import { AppUser } from './appuser.entity';
import { BenefitPolicy } from './benefit-policy.entity';
import { BenefitClaim } from './benefit-claim.entity';
import {
  EnrollmentType,
  EnrollmentStatus,
} from './enums/hr-policy-benefits.enums';

/**
 * Employee Benefit Enrollment Entity
 * Tracks employee enrollments in benefit policies
 */
@Entity('employee_benefit_enrollment')
@Index(['userId'])
@Index(['benefitPolicyId'])
@Index(['status'])
@Index(['effectiveFrom', 'effectiveTo'], { where: 'active = true' })
@Index(['enrollmentType'])
@Unique('unique_user_benefit_enrollment', ['userId', 'benefitPolicyId', 'effectiveFrom'])
export class EmployeeBenefitEnrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @Column({ type: 'int', name: 'benefit_policy_id' })
  benefitPolicyId: number;

  @ManyToOne(() => BenefitPolicy, (policy) => policy.enrollments)
  @JoinColumn({ name: 'benefit_policy_id' })
  benefitPolicy: BenefitPolicy;

  // Enrollment Details
  @Column({ type: 'date', name: 'enrollment_date', default: () => 'CURRENT_DATE' })
  enrollmentDate: Date;

  @Column({
    type: 'enum',
    enum: EnrollmentType,
    name: 'enrollment_type',
    default: EnrollmentType.AUTO,
  })
  enrollmentType: EnrollmentType;

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.ACTIVE,
  })
  status: EnrollmentStatus;

  // Custom Configuration
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'custom_coverage_amount',
  })
  customCoverageAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'custom_employee_contribution',
  })
  customEmployeeContribution: number;

  // Family Members
  @Column({ type: 'jsonb', nullable: true })
  dependents: Record<string, any>;

  // Nomination (for life insurance, gratuity, etc.)
  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'nominee_name',
  })
  nomineeName: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'nominee_relationship',
  })
  nomineeRelationship: string;

  @Column({ type: 'date', nullable: true, name: 'nominee_dob' })
  nomineeDob: Date;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'nominee_contact',
  })
  nomineeContact: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100,
    name: 'nominee_percentage',
  })
  nomineePercentage: number;

  // Approval Workflow
  @Column({ type: 'boolean', default: false, name: 'requires_approval' })
  requiresApproval: boolean;

  @Column({ type: 'int', nullable: true, name: 'approved_by' })
  approvedBy: number;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: AppUser;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_on' })
  approvedOn: Date;

  @Column({ type: 'text', nullable: true, name: 'approval_remarks' })
  approvalRemarks: string;

  // Effective Dates
  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom: Date;

  @Column({ type: 'date', nullable: true, name: 'effective_to' })
  effectiveTo: Date;

  @Column({ type: 'date', nullable: true, name: 'cancellation_date' })
  cancellationDate: Date;

  @Column({ type: 'text', nullable: true, name: 'cancellation_reason' })
  cancellationReason: string;

  // Audit
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // Relationships
  @OneToMany(() => BenefitClaim, (claim) => claim.enrollment)
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

  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_on' })
  updatedOn: Date;
}
