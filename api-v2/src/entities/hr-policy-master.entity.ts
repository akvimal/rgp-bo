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
import { PolicyCategory } from './enums/hr-policy-benefits.enums';
import { HrPolicyAcknowledgment } from './hr-policy-acknowledgment.entity';

/**
 * HR Policy Master Entity
 * Stores company-wide HR policies with flexible JSON configuration
 */
@Entity('hr_policy_master')
@Index(['policyCode'])
@Index(['policyCategory'])
@Index(['effectiveFrom', 'effectiveTo'], { where: 'active = true' })
@Index(['active', 'archive'])
export class HrPolicyMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'policy_code' })
  policyCode: string;

  @Column({ type: 'varchar', length: 100, name: 'policy_name' })
  policyName: string;

  @Column({
    type: 'enum',
    enum: PolicyCategory,
    name: 'policy_category',
  })
  policyCategory: PolicyCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'jsonb',
    name: 'policy_content',
    default: {},
  })
  policyContent: Record<string, any>;

  @Column({ type: 'boolean', default: false, name: 'is_mandatory' })
  isMandatory: boolean;

  @Column({ type: 'boolean', default: false, name: 'requires_approval' })
  requiresApproval: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom: Date;

  @Column({ type: 'date', nullable: true, name: 'effective_to' })
  effectiveTo: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  archive: boolean;

  // Relationships
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

  @OneToMany(
    () => HrPolicyAcknowledgment,
    (acknowledgment) => acknowledgment.policy,
  )
  acknowledgments: HrPolicyAcknowledgment[];

  // Audit columns
  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_on' })
  updatedOn: Date;
}
