import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("app_setting_pk", ["id"], { unique: true })
@Index("app_setting_key_un", ["key"], { unique: true })
@Entity("app_setting")
export class Setting extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "category", nullable: true, length: 80 })
  category: string | null;

  @Column("character varying", { name: "setting_key", unique: true, length: 120 })
  key: string;

  @Column("character varying", { name: "setting_value", nullable: true, length: 400 })
  value: string | null;

  @Column("character varying", { name: "description", nullable: true, length: 400 })
  description: string | null;
}
