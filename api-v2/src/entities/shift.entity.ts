import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { AppUser } from "./appuser.entity";
import { Store } from "./store.entity";
import { UserShift } from "./user-shift.entity";
import { Attendance } from "./attendance.entity";

@Index("shift_un", ["name", "storeid"], { unique: true })
@Index("shift_pk", ["id"], { unique: true })
@Entity("shift")
export class Shift extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "name", length: 50 })
  name: string;

  @Column({ type: "integer", name: "store_id" })
  storeid: number;

  @Column("time", { name: "start_time" })
  starttime: string;

  @Column("time", { name: "end_time" })
  endtime: string;

  @Column("integer", { name: "break_duration", default: 0 })
  breakduration: number;

  @Column("integer", { name: "grace_period_minutes", nullable: true, default: 0 })
  graceperiodminutes: number;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @ManyToOne(() => Store, (store) => store.shifts)
  @JoinColumn([{ name: "store_id", referencedColumnName: "id" }])
  store: Store;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  createdby_user: AppUser;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "updated_by", referencedColumnName: "id" }])
  updatedby_user: AppUser;

  @OneToMany(() => UserShift, (usershift) => usershift.shift)
  usershifts: UserShift[];

  @OneToMany(() => Attendance, (attendance) => attendance.shift)
  attendances: Attendance[];
}
