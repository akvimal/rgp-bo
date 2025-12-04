import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { AppUser } from "./appuser.entity";
import { Shift } from "./shift.entity";

@Index("user_shift_pk", ["id"], { unique: true })
@Entity("user_shift")
export class UserShift extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({ type: "integer", name: "user_id" })
  userid: number;

  @Column({ type: "integer", name: "shift_id" })
  shiftid: number;

  @Column("date", { name: "effective_from" })
  effectivefrom: Date;

  @Column("date", { name: "effective_to", nullable: true })
  effectiveto: Date | null;

  @Column("jsonb", { name: "days_of_week" })
  daysofweek: number[];

  @Column("boolean", { name: "is_default", nullable: true, default: false })
  isdefault: boolean;

  @ManyToOne(() => AppUser, (user) => user.usershifts)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;

  @ManyToOne(() => Shift, (shift) => shift.usershifts)
  @JoinColumn([{ name: "shift_id", referencedColumnName: "id" }])
  shift: Shift;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  createdby_user: AppUser;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "updated_by", referencedColumnName: "id" }])
  updatedby_user: AppUser;
}
