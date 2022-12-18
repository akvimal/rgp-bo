import { Exclude } from "class-transformer";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppRole } from "./approle.entity";
import { BaseEntity } from "./base.entity";
import { Sale } from "./sale.entity";

@Index("app_user_un", ["email"], { unique: true })
@Index("app_user_pk", ["id"], { unique: true })
@Entity("app_user")
export class AppUser extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({type: "integer", name: "role_id" })
  roleid: number;
  
  @Column("character varying", { name: "email", length: 40 })
  email: string;

  @Exclude()
  @Column({ type: 'varchar' })
  public password!: string;

  @Column("character varying", { name: "phone", nullable: true })
  phone: string | null;

  @Column("character varying", { name: "location", nullable: true, length: 80 })
  location: string | null;

  @Column("character varying", { name: "full_name", length: 40 })
  fullname: string;

  @Column({ name: "last_login", type: 'timestamp', nullable: true, default: null })
  public lastlogin: Date | null;

  @ManyToOne(() => AppRole, (appRole) => appRole.appUsers)
  @JoinColumn([{ name: "role_id", referencedColumnName: "id" }])
  role: AppRole;

  @OneToMany(() => Sale, (sale) => sale.created)
  sales: Sale[];
}