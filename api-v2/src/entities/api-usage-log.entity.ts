import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";

@Index("api_usage_log_pk", ["id"], { unique: true })
@Entity("api_usage_log")
export class ApiUsageLog {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({ type: "integer", name: "user_id", nullable: true })
  userid: number | null;

  @Column("character varying", { name: "endpoint", length: 200 })
  endpoint: string;

  @Column("character varying", { name: "method", length: 10 })
  method: string;

  @Column("integer", { name: "status_code" })
  statuscode: number;

  @Column("integer", { name: "response_time_ms" })
  responsetimems: number;

  @Column("character varying", { name: "ip_address", nullable: true, length: 45 })
  ipaddress: string | null;

  @Column("character varying", { name: "user_agent", nullable: true, length: 500 })
  useragent: string | null;

  @Column("jsonb", { name: "request_body", nullable: true })
  requestbody: any;

  @Column("jsonb", { name: "response_body", nullable: true })
  responsebody: any;

  @Column({ name: 'timestamp', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;
}
