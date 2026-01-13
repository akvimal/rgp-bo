import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SubFeature } from './sub-feature.entity';
import { Permission } from './access-level.entity';

@Entity('sub_feature_access_level')
export class SubFeatureAccessLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sub_feature_id' })
  subFeatureId: number;

  @Column({ name: 'level_name', length: 50 })
  levelName: string;

  @Column({ name: 'level_order' })
  levelOrder: number;

  @Column({ name: 'display_name', length: 50 })
  displayName: string;

  @Column({ type: 'jsonb' })
  permissions: Permission[];

  @Column({ default: true })
  active: boolean;

  // Relations
  @ManyToOne(() => SubFeature, subFeature => subFeature.accessLevels)
  @JoinColumn({ name: 'sub_feature_id' })
  subFeature: SubFeature;
}
