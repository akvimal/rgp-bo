import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { AppRole } from './approle.entity';
import { FeatureGroup } from './feature-group.entity';
import { AccessLevel } from './access-level.entity';
import { AppUser } from './appuser.entity';
import { RoleSubFeatureAssignment } from './role-sub-feature-assignment.entity';

@Entity('role_feature_assignment')
export class RoleFeatureAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id' })
  roleId: number;

  @Column({ name: 'feature_group_id' })
  featureGroupId: number;

  @Column({ name: 'access_level_id', nullable: true })
  accessLevelId: number;

  @Column({ name: 'data_scope', length: 20, default: 'all' })
  dataScope: string;

  @Column({ type: 'jsonb', default: {} })
  options: Record<string, any>;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'assigned_on', type: 'timestamp with time zone' })
  assignedOn: Date;

  @Column({ name: 'assigned_by', nullable: true })
  assignedBy: number;

  // Relations
  @ManyToOne(() => AppRole)
  @JoinColumn({ name: 'role_id' })
  role: AppRole;

  @ManyToOne(() => FeatureGroup, featureGroup => featureGroup.roleAssignments)
  @JoinColumn({ name: 'feature_group_id' })
  featureGroup: FeatureGroup;

  @ManyToOne(() => AccessLevel)
  @JoinColumn({ name: 'access_level_id' })
  accessLevel: AccessLevel;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'assigned_by' })
  assignedByUser: AppUser;

  @OneToMany(() => RoleSubFeatureAssignment, subFeatureAssignment => subFeatureAssignment.roleFeatureAssignment)
  subFeatureAssignments: RoleSubFeatureAssignment[];
}
