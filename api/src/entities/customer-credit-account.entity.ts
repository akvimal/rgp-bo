import {
    Column,
    Entity,
    Index, JoinColumn, ManyToOne, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { Customer } from "./customer.entity";
  
  @Index("customer_credit_acount_pk", ["id"], { unique: true })
  @Entity("customer_credit_accounts")

  export class CustomerCreditAccount {
  
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
      () => Customer,
      (customer) => customer.credits
    )
    @JoinColumn([{ name: "customer_id", referencedColumnName: "id" }])
    customer: Customer;
}