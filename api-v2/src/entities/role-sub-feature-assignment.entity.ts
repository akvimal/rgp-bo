import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RoleFeatureAssignment } from './role-feature-assignment.entity';
import { SubFeature } from './sub-feature.entity';
import { SubFeatureAccessLevel } from './sub-feature-access-level.entity';

@Entity('role_sub_feature_assignment')
export class RoleSubFeatureAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_feature_assignment_id' })
  roleFeatureAssignmentId: number;

  @Column({ name: 'sub_feature_id' })
  subFeatureId: number;

  @Column({ name: 'access_level_id', nullable: true })
  accessLevelId: number;

  @Column({ default: true })
  active: boolean;

  // Relations
  @ManyToOne(() => RoleFeatureAssignment, roleFeatureAssignment => roleFeatureAssignment.subFeatureAssignments)
  @JoinColumn({ name: 'role_feature_assignment_id' })
  roleFeatureAssignment: RoleFeatureAssignment;

  @ManyToOne(() => SubFeature)
  @JoinColumn({ name: 'sub_feature_id' })
  subFeature: SubFeature;

  @ManyToOne(() => SubFeatureAccessLevel)
  @JoinColumn({ name: 'access_level_id' })
  accessLevel: SubFeatureAccessLevel;
}
