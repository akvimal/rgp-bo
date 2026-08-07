import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Store } from "./store.entity";
import { AppUser } from "./appuser.entity";
import { StoreShift } from "./store-shift.entity";

@Index("store_shift_template_pk", ["id"], { unique: true })
@Entity("store_shift_templates")
export class StoreShiftTemplate {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "store_id" })
  storeid: number;

  @Column("character varying", { name: "name", length: 60 })
  name: string;

  @Column("character varying", { name: "start_time", length: 10 })
  starttime: string;

  @Column("character varying", { name: "end_time", length: 10 })
  endtime: string;

  @Column("double precision", { name: "deposit_threshold", precision: 53, default: 0 })
  depositthreshold: number;

  @Column({ name: "active", type: "boolean", default: true })
  active: boolean;

  @Column("integer", { name: "assigned_user_id", nullable: true })
  assigneduserid: number | null;

  @ManyToOne(() => Store, (store) => store.shifttemplates)
  @JoinColumn([{ name: "store_id", referencedColumnName: "id" }])
  store: Store;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn([{ name: "assigned_user_id", referencedColumnName: "id" }])
  assigneduser: AppUser | null;

  @OneToMany(() => StoreShift, (shift) => shift.template)
  shifts: StoreShift[];
}
