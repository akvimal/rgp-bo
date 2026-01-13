import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AccessLevel } from './access-level.entity';
import { SubFeature } from './sub-feature.entity';
import { RoleFeatureAssignment } from './role-feature-assignment.entity';

@Entity('feature_group')
export class FeatureGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_on', type: 'timestamp with time zone' })
  createdOn: Date;

  @UpdateDateColumn({ name: 'updated_on', type: 'timestamp with time zone' })
  updatedOn: Date;

  // Relations
  @OneToMany(() => AccessLevel, accessLevel => accessLevel.featureGroup)
  accessLevels: AccessLevel[];

  @OneToMany(() => SubFeature, subFeature => subFeature.featureGroup)
  subFeatures: SubFeature[];

  @OneToMany(() => RoleFeatureAssignment, assignment => assignment.featureGroup)
  roleAssignments: RoleFeatureAssignment[];
}
