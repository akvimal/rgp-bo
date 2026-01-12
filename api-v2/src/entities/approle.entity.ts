import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { AppUser } from "../entities/appuser.entity";
import { BaseEntity } from "./base.entity";

@Index("app_role_un", ["name"], { unique: true })
@Index("app_role_pk", ["id"], { unique: true })
@Entity("app_role")
export class AppRole extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;
  
  @Column("character varying", { name: "name", length: 40 })
  name: string;
  
  @Column("json", { name: "permissions", nullable: true })
  permissions: object | null;
  
  @Column({ name: 'locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'uses_feature_groups', type: 'boolean', default: false })
  usesFeatureGroups: boolean;

  @OneToMany(() => AppUser, (appUser) => appUser.role)
  appUsers: AppUser[];
}
