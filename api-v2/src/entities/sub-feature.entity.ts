import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { FeatureGroup } from './feature-group.entity';
import { SubFeatureAccessLevel } from './sub-feature-access-level.entity';

@Entity('sub_feature')
export class SubFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'feature_group_id' })
  featureGroupId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;

  // Relations
  @ManyToOne(() => FeatureGroup, featureGroup => featureGroup.subFeatures)
  @JoinColumn({ name: 'feature_group_id' })
  featureGroup: FeatureGroup;

  @OneToMany(() => SubFeatureAccessLevel, accessLevel => accessLevel.subFeature)
  accessLevels: SubFeatureAccessLevel[];
}
