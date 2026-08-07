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
import { Store } from "./store.entity";
import { StoreShiftTemplate } from "./store-shift-template.entity";
import { StoreCashAccount } from "./store-cash-account.entity";

@Index("store_shift_pk", ["id"], { unique: true })
@Entity("store_shifts")
export class StoreShift {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "store_id" })
  storeid: number;

  @Column("integer", { name: "template_id", nullable: true })
  templateid: number | null;

  @Column("date", { name: "shift_date" })
  shiftdate: string;

  @Column("character varying", { name: "name", length: 60 })
  name: string;

  @Column("character varying", { name: "start_time", length: 10 })
  starttime: string;

  @Column("character varying", { name: "end_time", length: 10 })
  endtime: string;

  @Column("character varying", { name: "status", length: 20, default: "OPEN" })
  status: string;

  @Column("double precision", { name: "opening_cash", precision: 53, default: 0 })
  openingcash: number;

  @Column("double precision", { name: "expected_cash", precision: 53, default: 0 })
  expectedcash: number;

  @Column("double precision", { name: "counted_cash", precision: 53, nullable: true })
  countedcash: number | null;

  @Column("double precision", { name: "variance", precision: 53, nullable: true })
  variance: number | null;

  @Column("double precision", { name: "deposit_threshold", precision: 53, default: 0 })
  depositthreshold: number;

  @Column("integer", { name: "assigned_user_id", nullable: true })
  assigneduserid: number | null;

  @Column("timestamp without time zone", { name: "opened_on", nullable: true })
  openedon: Date | null;

  @Column("timestamp without time zone", { name: "closed_on", nullable: true })
  closedon: Date | null;

  @Column("character varying", { name: "notes", nullable: true })
  notes: string | null;

  @ManyToOne(() => Store, (store) => store.shifts)
  @JoinColumn([{ name: "store_id", referencedColumnName: "id" }])
  store: Store;

  @ManyToOne(() => StoreShiftTemplate, (template) => template.shifts, { nullable: true })
  @JoinColumn([{ name: "template_id", referencedColumnName: "id" }])
  template: StoreShiftTemplate | null;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn([{ name: "assigned_user_id", referencedColumnName: "id" }])
  assigneduser: AppUser | null;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn([{ name: "opened_by", referencedColumnName: "id" }])
  openedby: AppUser | null;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn([{ name: "closed_by", referencedColumnName: "id" }])
  closedby: AppUser | null;

  @OneToMany(() => StoreCashAccount, (account) => account.shift)
  cashaccounts: StoreCashAccount[];
}
