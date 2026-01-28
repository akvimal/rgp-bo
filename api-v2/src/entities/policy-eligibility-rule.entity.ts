import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AppUser } from './appuser.entity';
import { EntityType } from './enums/hr-policy-benefits.enums';

/**
 * Policy Eligibility Rule Entity
 * Defines who is eligible for which policies and benefits
 */
@Entity('policy_eligibility_rule')
@Index(['entityType', 'entityId'])
@Index(['employmentTypes'], { spatial: true }) // GIN index for array
@Index(['roleCodes'], { spatial: true }) // GIN index for array
@Index(['storeIds'], { spatial: true }) // GIN index for array
@Index(['effectiveFrom', 'effectiveTo'], { where: 'active = true' })
export class PolicyEligibilityRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'rule_name' })
  ruleName: string;

  @Column({
    type: 'enum',
    enum: EntityType,
    name: 'entity_type',
  })
  entityType: EntityType;

  @Column({ type: 'int', name: 'entity_id' })
  entityId: number;

  // Eligibility Criteria
  @Column({
    type: 'varchar',
    length: 20,
    array: true,
    nullable: true,
    name: 'employment_types',
  })
  employmentTypes: string[];

  @Column({
    type: 'varchar',
    length: 50,
    array: true,
    nullable: true,
    name: 'role_codes',
  })
  roleCodes: string[];

  @Column({ type: 'int', nullable: true, name: 'min_tenure_months' })
  minTenureMonths: number;

  @Column({ type: 'int', nullable: true, name: 'max_tenure_months' })
  maxTenureMonths: number;

  @Column({
    type: 'int',
    array: true,
    nullable: true,
    name: 'store_ids',
  })
  storeIds: number[];

  // Custom Rules
  @Column({ type: 'text', nullable: true, name: 'custom_rule_sql' })
  customRuleSql: string;

  // Priority
  @Column({ type: 'int', default: 0 })
  priority: number;

  // Effective Dates
  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom: Date;

  @Column({ type: 'date', nullable: true, name: 'effective_to' })
  effectiveTo: Date;

  // Audit
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: AppUser;

  @Column({ type: 'int', nullable: true, name: 'created_by' })
  createdBy: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;
}
