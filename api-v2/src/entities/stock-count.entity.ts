import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";

@Index("stock_count_pk", ["id"], { unique: true })
@Entity("stock_count")
export class StockCount {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "status", length: 20, default: "IN_PROGRESS" })
  status: string;

  @Column("character varying", { name: "category", length: 60, nullable: true })
  category: string | null;

  @Column("integer", { name: "store_id", nullable: true })
  storeid: number | null;

  @Column("integer", { name: "started_by" })
  startedby: number;

  @Column("timestamp with time zone", { name: "started_on" })
  startedon: Date;

  @Column("integer", { name: "completed_by", nullable: true })
  completedby: number | null;

  @Column("timestamp with time zone", { name: "completed_on", nullable: true })
  completedon: Date | null;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "started_by", referencedColumnName: "id" }])
  starteduser: AppUser;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn([{ name: "completed_by", referencedColumnName: "id" }])
  completeduser: AppUser | null;
}
