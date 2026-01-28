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
import {
  BenefitCategory,
  CalculationBasis,
} from './enums/hr-policy-benefits.enums';
import { BenefitPolicy } from './benefit-policy.entity';

/**
 * Benefit Master Entity
 * Catalog of all benefit types available in the organization
 */
@Entity('benefit_master')
@Index(['benefitCode'])
@Index(['benefitCategory'])
@Index(['active', 'archive'])
export class BenefitMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'benefit_code' })
  benefitCode: string;

  @Column({ type: 'varchar', length: 100, name: 'benefit_name' })
  benefitName: string;

  @Column({
    type: 'enum',
    enum: BenefitCategory,
    name: 'benefit_category',
  })
  benefitCategory: BenefitCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false, name: 'is_statutory' })
  isStatutory: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_taxable' })
  isTaxable: boolean;

  @Column({
    type: 'enum',
    enum: CalculationBasis,
    nullable: true,
    name: 'calculation_basis',
  })
  calculationBasis: CalculationBasis;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  archive: boolean;

  // Relationships
  @OneToMany(() => BenefitPolicy, (policy) => policy.benefit)
  policies: BenefitPolicy[];

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
