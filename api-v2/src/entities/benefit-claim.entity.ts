import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AppUser } from './appuser.entity';
import { BenefitPolicy } from './benefit-policy.entity';
import { EmployeeBenefitEnrollment } from './employee-benefit-enrollment.entity';
import {
  ClaimType,
  ClaimStatus,
  PaymentMode,
} from './enums/hr-policy-benefits.enums';

/**
 * Benefit Claim Entity
 * Tracks benefit claims and reimbursements
 */
@Entity('benefit_claim')
@Index(['enrollmentId'])
@Index(['userId'])
@Index(['benefitPolicyId'])
@Index(['status'])
@Index(['claimNumber'], { unique: true })
@Index(['claimDate'])
@Index(['payrollRunId'])
export class BenefitClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'enrollment_id' })
  enrollmentId: number;

  @ManyToOne(() => EmployeeBenefitEnrollment, (enrollment) => enrollment.claims)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: EmployeeBenefitEnrollment;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @Column({ type: 'int', name: 'benefit_policy_id' })
  benefitPolicyId: number;

  @ManyToOne(() => BenefitPolicy, (policy) => policy.claims)
  @JoinColumn({ name: 'benefit_policy_id' })
  benefitPolicy: BenefitPolicy;

  // Claim Details
  @Column({ type: 'varchar', length: 50, unique: true, name: 'claim_number' })
  claimNumber: string;

  @Column({ type: 'date', name: 'claim_date', default: () => 'CURRENT_DATE' })
  claimDate: Date;

  @Column({
    type: 'enum',
    enum: ClaimType,
    name: 'claim_type',
  })
  claimType: ClaimType;

  @Column({ type: 'date', nullable: true, name: 'incident_date' })
  incidentDate: Date;

  // Amount Details
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'claimed_amount',
  })
  claimedAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'approved_amount',
  })
  approvedAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'rejected_amount',
  })
  rejectedAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'paid_amount',
  })
  paidAmount: number;

  // Description & Documents
  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  documents: Record<string, any>;

  // Workflow
  @Column({
    type: 'enum',
    enum: ClaimStatus,
    default: ClaimStatus.SUBMITTED,
  })
  status: ClaimStatus;

  @Column({
    type: 'timestamptz',
    name: 'submitted_date',
    default: () => 'CURRENT_TIMESTAMP',
  })
  submittedDate: Date;

  @Column({ type: 'int', nullable: true, name: 'reviewed_by' })
  reviewedBy: number;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedByUser: AppUser;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_on' })
  reviewedOn: Date;

  @Column({ type: 'text', nullable: true, name: 'reviewer_remarks' })
  reviewerRemarks: string;

  @Column({ type: 'int', nullable: true, name: 'approved_by' })
  approvedBy: number;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: AppUser;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_on' })
  approvedOn: Date;

  @Column({ type: 'text', nullable: true, name: 'approval_remarks' })
  approvalRemarks: string;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string;

  // Payment Details
  @Column({
    type: 'enum',
    enum: PaymentMode,
    nullable: true,
    name: 'payment_mode',
  })
  paymentMode: PaymentMode;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'payment_reference',
  })
  paymentReference: string;

  @Column({ type: 'date', nullable: true, name: 'payment_date' })
  paymentDate: Date;

  @Column({ type: 'int', nullable: true, name: 'payroll_run_id' })
  payrollRunId: number;

  // Audit
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
