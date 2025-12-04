import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";
import { Shift } from "./shift.entity";

export enum AttendanceStatus {
  PENDING = 'PENDING',
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
  REMOTE_WORK = 'REMOTE_WORK',
  BUSINESS_TRAVEL = 'BUSINESS_TRAVEL',
  PUBLIC_HOLIDAY = 'PUBLIC_HOLIDAY'
}

@Index("attendance_un", ["userid", "attendancedate"], { unique: true })
@Index("attendance_pk", ["id", "attendancedate"], { unique: true })
@Entity("attendance")
export class Attendance {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({ type: "integer", name: "user_id" })
  userid: number;

  @Column("date", { name: "attendance_date" })
  attendancedate: Date;

  @Column({ type: "integer", name: "shift_id", nullable: true })
  shiftid: number | null;

  @Column({
    type: "enum",
    enum: AttendanceStatus,
    default: AttendanceStatus.PENDING
  })
  status: AttendanceStatus;

  @Column({ type: "timestamptz", name: "clock_in_time", nullable: true })
  clockintime: Date | null;

  @Column({ type: "timestamptz", name: "clock_out_time", nullable: true })
  clockouttime: Date | null;

  @Column("character varying", { name: "clock_in_photo_path", nullable: true, length: 500 })
  clockinphotourl: string | null;

  @Column("character varying", { name: "clock_out_photo_path", nullable: true, length: 500 })
  clockoutphotourl: string | null;

  @Column({ type: "numeric", name: "total_hours", nullable: true, precision: 5, scale: 2 })
  totalhours: number | null;

  @Column("text", { name: "remarks", nullable: true })
  remarks: string | null;

  @Column({ name: 'created_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdon: Date;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdby: number | null;

  @Column({ name: 'updated_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedon: Date;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedby: number | null;

  @ManyToOne(() => AppUser, (user) => user.attendances)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;

  @ManyToOne(() => Shift, (shift) => shift.attendances)
  @JoinColumn([{ name: "shift_id", referencedColumnName: "id" }])
  shift: Shift;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  createdby_user: AppUser;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "updated_by", referencedColumnName: "id" }])
  updatedby_user: AppUser;
}
