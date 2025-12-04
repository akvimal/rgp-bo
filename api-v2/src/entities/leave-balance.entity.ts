import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";
import { LeaveType } from "./leave-type.entity";

@Index("leave_balance_un", ["userid", "leavetypeid", "year"], { unique: true })
@Index("leave_balance_pk", ["id"], { unique: true })
@Entity("leave_balance")
export class LeaveBalance {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({ type: "integer", name: "user_id" })
  userid: number;

  @Column({ type: "integer", name: "leave_type_id" })
  leavetypeid: number;

  @Column("integer", { name: "year" })
  year: number;

  @Column("numeric", { name: "opening_balance", precision: 4, scale: 1, default: 0 })
  openingbalance: number;

  @Column("numeric", { name: "earned", precision: 4, scale: 1, default: 0 })
  earned: number;

  @Column("numeric", { name: "used", precision: 4, scale: 1, default: 0 })
  used: number;

  @Column("numeric", { name: "balance", precision: 4, scale: 1, default: 0 })
  balance: number;

  @Column("timestamptz", { name: "last_updated", default: () => "CURRENT_TIMESTAMP" })
  lastupdated: Date;

  @ManyToOne(() => AppUser, (user) => user.leavebalances)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;

  @ManyToOne(() => LeaveType, (leavetype) => leavetype.leavebalances)
  @JoinColumn([{ name: "leave_type_id", referencedColumnName: "id" }])
  leavetype: LeaveType;
}
