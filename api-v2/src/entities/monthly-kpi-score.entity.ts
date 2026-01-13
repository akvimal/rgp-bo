import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AppUser } from './appuser.entity';
import { EmploymentTypeMaster } from './employment-type-master.entity';
import { RoleMaster } from './role-master.entity';

@Entity('monthly_kpi_score')
export class MonthlyKpiScore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  // Employment Configuration (snapshot)
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

  // Category-wise Scores (JSON)
  @Column({ type: 'jsonb', default: {}, name: 'category_scores' })
  categoryScores: Record<string, number>;

  // Total Score
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'total_score' })
  totalScore: number;

  @Column({ type: 'int', default: 100, name: 'max_possible_score' })
  maxPossibleScore: number;

  // KPI Band (for payroll calculation)
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'kpi_band' })
  kpiBand: string; // "90-100", "75-89", "60-74", "50-59", "below-50"

  // Status
  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string; // DRAFT, SUBMITTED, APPROVED, LOCKED

  // Workflow
  @Column({ type: 'int', nullable: true, name: 'evaluated_by' })
  evaluatedBy: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'evaluated_on' })
  evaluatedOn: Date;

  @Column({ type: 'int', nullable: true, name: 'approved_by' })
  approvedBy: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_on' })
  approvedOn: Date;

  @Column({ type: 'text', nullable: true, name: 'approval_remarks' })
  approvalRemarks: string;

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
