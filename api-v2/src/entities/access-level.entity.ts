import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FeatureGroup } from './feature-group.entity';

export interface Permission {
  resource: string;
  action: string;
  dataScope?: string;
  fields?: string[];
}

@Entity('access_level')
export class AccessLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'feature_group_id' })
  featureGroupId: number;

  @Column({ name: 'level_name', length: 50 })
  levelName: string;

  @Column({ name: 'level_order' })
  levelOrder: number;

  @Column({ name: 'display_name', length: 50 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  permissions: Permission[];

  @Column({ default: true })
  active: boolean;

  // Relations
  @ManyToOne(() => FeatureGroup, featureGroup => featureGroup.accessLevels)
  @JoinColumn({ name: 'feature_group_id' })
  featureGroup: FeatureGroup;
}
