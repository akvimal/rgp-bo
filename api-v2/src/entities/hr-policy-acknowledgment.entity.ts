import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { AppUser } from './appuser.entity';
import { HrPolicyMaster } from './hr-policy-master.entity';
import { PolicyAcknowledgmentMethod } from './enums/hr-policy-benefits.enums';

/**
 * HR Policy Acknowledgment Entity
 * Tracks employee acknowledgment of HR policies
 */
@Entity('hr_policy_acknowledgment')
@Index(['userId'])
@Index(['policyId'])
@Index(['acknowledgedOn'])
@Unique('unique_user_policy_acknowledgment', ['userId', 'policyId', 'policyVersion'])
export class HrPolicyAcknowledgment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @Column({ type: 'int', name: 'policy_id' })
  policyId: number;

  @ManyToOne(() => HrPolicyMaster, (policy) => policy.acknowledgments)
  @JoinColumn({ name: 'policy_id' })
  policy: HrPolicyMaster;

  // Acknowledgment Details
  @Column({
    type: 'timestamptz',
    name: 'acknowledged_on',
    default: () => 'CURRENT_TIMESTAMP',
  })
  acknowledgedOn: Date;

  @Column({
    type: 'enum',
    enum: PolicyAcknowledgmentMethod,
    name: 'acknowledgment_method',
  })
  acknowledgmentMethod: PolicyAcknowledgmentMethod;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string;

  @Column({ type: 'text', nullable: true, name: 'digital_signature' })
  digitalSignature: string;

  // Policy Version Snapshot
  @Column({ type: 'int', name: 'policy_version' })
  policyVersion: number;

  @Column({ type: 'jsonb', name: 'policy_content_snapshot' })
  policyContentSnapshot: Record<string, any>;

  // Audit
  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;
}
