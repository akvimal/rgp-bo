import {
    Column,
    Entity,
    Index, JoinColumn, ManyToOne, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { Store } from "./store.entity";
import { StoreShift } from "./store-shift.entity";
  
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

    @Column("character varying", { name: "reference_no", length: 40, nullable: true })
    referenceno: string | null;

    @Column("character varying", { name: "expense_category", length: 30, nullable: true })
    expensecategory: string | null;

    @Column("character varying", { name: "receipt_path", length: 255, nullable: true })
    receiptpath: string | null;

    @ManyToOne(
      () => Store,
      (store) => store.transactions
    )
    @JoinColumn([{ name: "store_id", referencedColumnName: "id" }])
    store: Store;

    @Column("integer", { name: "shift_id", nullable: true })
    shiftid: number | null;

    @ManyToOne(
      () => StoreShift,
      (shift) => shift.cashaccounts,
      { nullable: true }
    )
    @JoinColumn([{ name: "shift_id", referencedColumnName: "id" }])
    shift: StoreShift | null;
}
