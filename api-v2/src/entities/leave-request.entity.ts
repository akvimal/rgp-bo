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

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

@Index("leave_request_pk", ["id"], { unique: true })
@Entity("leave_request")
export class LeaveRequest {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column({ type: "integer", name: "user_id" })
  userid: number;

  @Column({ type: "integer", name: "leave_type_id" })
  leavetypeid: number;

  @Column("date", { name: "start_date" })
  startdate: Date;

  @Column("date", { name: "end_date" })
  enddate: Date;

  @Column("numeric", { name: "total_days", precision: 4, scale: 1 })
  totaldays: number;

  @Column("text", { name: "reason", nullable: true })
  reason: string | null;

  @Column({
    type: "enum",
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING
  })
  status: LeaveRequestStatus;

  @Column({ type: "timestamptz", name: "applied_on", default: () => 'CURRENT_TIMESTAMP' })
  appliedon: Date;

  @Column({ type: "integer", name: "approved_by", nullable: true })
  approvedby: number | null;

  @Column({ type: "timestamptz", name: "approved_on", nullable: true })
  approvedon: Date | null;

  @Column("text", { name: "approval_comments", nullable: true })
  approvalcomments: string | null;

  @Column("character varying", { name: "document_url", nullable: true, length: 500 })
  documenturl: string | null;

  @Column({ name: 'created_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdon: Date;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdby: number | null;

  @Column({ name: 'updated_on', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedon: Date;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedby: number | null;

  @ManyToOne(() => AppUser, (user) => user.leaverequests)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;

  @ManyToOne(() => LeaveType, (leavetype) => leavetype.leaverequests)
  @JoinColumn([{ name: "leave_type_id", referencedColumnName: "id" }])
  leavetype: LeaveType;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "approved_by", referencedColumnName: "id" }])
  approver: AppUser;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  createdby_user: AppUser;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "updated_by", referencedColumnName: "id" }])
  updatedby_user: AppUser;
}
