import {
    Column,
    Entity,
    Index, JoinColumn, ManyToOne, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { Store } from "./store.entity";
  
  @Index("store_acount_pk", ["id"], { unique: true })
  @Entity("store_cash_accounts")

  export class StoreCashAccount {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("date", { name: "trans_date" })
    transdate: string;

    @Column("character varying", { name: "category", length: 40 })
    category: string;
    @Column("character varying", { name: "description" })
    description: string;

    @Column("double precision", { name: "deposit", precision: 53 })
    deposit: number;
    @Column("double precision", { name: "withdraw", precision: 53 })
    withdraw: number;

    @ManyToOne(
      () => Store,
      (store) => store.transactions
    )
    @JoinColumn([{ name: "store_id", referencedColumnName: "id" }])
    store: Store;
}