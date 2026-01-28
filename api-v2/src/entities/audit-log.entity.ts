import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";

@Index("audit_log_pk", ["id"], { unique: true })
@Entity("audit_log")
export class AuditLog {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({ type: "integer", name: "user_id", nullable: true })
  userid: number | null;

  @Column("character varying", { name: "action", length: 100 })
  action: string;

  @Column("character varying", { name: "resource_type", length: 50 })
  resourcetype: string;

  @Column("integer", { name: "resource_id", nullable: true })
  resourceid: number | null;

  @Column("jsonb", { name: "old_values", nullable: true })
  oldvalues: any;

  @Column("jsonb", { name: "new_values", nullable: true })
  newvalues: any;

  @Column("character varying", { name: "ip_address", nullable: true, length: 45 })
  ipaddress: string | null;

  @Column({ name: 'timestamp', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;
}
