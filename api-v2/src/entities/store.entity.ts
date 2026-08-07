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
