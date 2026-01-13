import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EmploymentTypeMaster } from './employment-type-master.entity';

@Entity('role_master')
export class RoleMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20, name: 'employment_type_code' })
  employmentTypeCode: string;

  @ManyToOne(() => EmploymentTypeMaster)
  @JoinColumn({ name: 'employment_type_code', referencedColumnName: 'code' })
  employmentType: EmploymentTypeMaster;

  @Column({ type: 'int', default: 0 })
  level: number;

  @Column({ type: 'int', nullable: true, name: 'parent_role_id' })
  parentRoleId: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
  createdOn: Date;
}
