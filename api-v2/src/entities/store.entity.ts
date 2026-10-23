import {
    Column,
    Entity,
    Index, JoinColumn, ManyToOne, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { Business } from "./business.entity";
import { StoreCashAccount } from "./store-cash-account.entity";
import { StoreShift } from "./store-shift.entity";
import { StoreShiftTemplate } from "./store-shift-template.entity";
import { UserStore } from "./user-store.entity";
  
  @Index("store_pk", ["id"], { unique: true })
  @Entity("stores")

  export class Store {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
  @Column("character varying", { name: "location", length: 40 })
  location: string;

  @Column("double precision", { name: "deposit_threshold", precision: 53, default: 0 })
  depositthreshold: number;

  @Column("character varying", { name: "telegram_chat_id", length: 40, nullable: true })
  telegramchatid: string | null;

  @Column({ name: "telegram_digest_enabled", type: "boolean", default: true })
  telegramdigestenabled: boolean;

  @Column("character varying", { name: "address", length: 200, nullable: true })
  address: string | null;

  @Column("character varying", { name: "pincode", length: 10, nullable: true })
  pincode: string | null;

  @Column("character varying", { name: "phone", length: 20, nullable: true })
  phone: string | null;

  /** pharmacy (has a pharmacist; registration is kept for its staff) or other (a warehouse, a general shop) */
  @Column("character varying", { name: "store_type", length: 10, default: "pharmacy" })
  storetype: string;

  @Column("character varying", { name: "shift_mode", length: 10, default: "time" })
  shiftmode: string;

  @Column("character varying", { name: "till", length: 12, nullable: true })
  till: string | null;

  @Column("character varying", { name: "accountable_role", length: 15, default: "auto" })
  accountablerole: string;

  @Column({ name: "operator_required", type: "boolean", default: true })
  operatorrequired: boolean;

  @Column("integer", { name: "operator_hold_minutes", default: 60 })
  operatorholdminutes: number;

  @Column("character varying", { name: "approval_mode", length: 10, nullable: true })
  approvalmode: string | null;

  @Column({ name: "active", type: "boolean", default: true })
  isActive: boolean;

  @Column({ name: "archive", type: "boolean", default: false })
  isArchived: boolean;
  
    @ManyToOne(
      () => Business,
      (business) => business.stores
    )
    @JoinColumn([{ name: "business_id", referencedColumnName: "id" }])
    business: Business;

    @OneToMany(
      () => StoreCashAccount,
      (loc) => loc.store
    )
    transactions: StoreCashAccount[];

    @OneToMany(
      () => StoreShiftTemplate,
      (template) => template.store
    )
    shifttemplates: StoreShiftTemplate[];

    @OneToMany(
      () => StoreShift,
      (shift) => shift.store
    )
    shifts: StoreShift[];

    @OneToMany(
      () => UserStore,
      (assignment) => assignment.store
    )
    userassignments: UserStore[];
}
