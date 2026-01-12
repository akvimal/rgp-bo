import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { AppUser } from './appuser.entity';
import { AppRole } from './approle.entity';

/**
 * UserRoleAssignment Entity
 *
 * Enables users to have multiple roles. Permissions from all active roles
 * are merged when user authenticates.
 *
 * @example
 * // User can be both Store Manager AND Pharmacist
 * // Permissions will be union of both roles
 */
@Entity('user_role_assignment')
export class UserRoleAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'role_id' })
  role_id: number;

  @Column({ name: 'assigned_by', nullable: true })
  assigned_by: number;

  @Column({
    name: 'assigned_on',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP'
  })
  assigned_on: Date;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_on' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on' })
  updated_on: Date;

  // Relations
  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @ManyToOne(() => AppRole, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: AppRole;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn({ name: 'assigned_by' })
  assignedBy: AppUser;
}
