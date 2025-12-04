import {
    Column,
    Entity,
    Index, JoinColumn, ManyToOne, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { Business } from "./business.entity";
import { StoreCashAccount } from "./store-cash-account.entity";
import { Shift } from "./shift.entity";
  
  @Index("store_pk", ["id"], { unique: true })
  @Entity("stores")

  export class Store {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "location", length: 40 })
    location: string;
  
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

    @OneToMany(() => Shift, (shift) => shift.store)
    shifts: Shift[];
}