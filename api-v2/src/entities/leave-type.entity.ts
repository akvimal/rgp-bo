import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";
import { LeaveRequest } from "./leave-request.entity";
import { LeaveBalance } from "./leave-balance.entity";

@Index("leave_type_code_key", ["code"], { unique: true })
@Index("leave_type_name_key", ["name"], { unique: true })
@Index("leave_type_pk", ["id"], { unique: true })
@Entity("leave_type")
export class LeaveType {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "name", length: 50 })
  name: string;

  @Column("character varying", { name: "code", length: 20 })
  code: string;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("integer", { name: "max_days_per_year", default: 0 })
  maxdaysperyear: number;

  @Column("boolean", { name: "requires_document", default: false })
  requiresdocument: boolean;

  @Column("boolean", { name: "is_paid", default: true })
  ispaid: boolean;

  @Column("boolean", { name: "carry_forward", default: false })
  carryforward: boolean;

  @Column("character varying", { name: "color_code", nullable: true, length: 7 })
  colorcode: string | null;

  @Column("boolean", { name: "active", default: true })
  active: boolean;

  @Column({ name: 'created_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdon: Date;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdby: number | null;

  @Column({ name: 'updated_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedon: Date;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedby: number | null;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  createdby_user: AppUser;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "updated_by", referencedColumnName: "id" }])
  updatedby_user: AppUser;

  @OneToMany(() => LeaveRequest, (leaverequest) => leaverequest.leavetype)
  leaverequests: LeaveRequest[];

  @OneToMany(() => LeaveBalance, (leavebalance) => leavebalance.leavetype)
  leavebalances: LeaveBalance[];
}
