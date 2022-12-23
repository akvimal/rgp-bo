import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./AppUser.entity";
import { BaseEntity } from "./base.entity";
import { Customer } from "./customer.entity";
import { SaleItem } from "./sale-item.entity";

@Index("sale_pk", ["id"], { unique: true })
@Entity("sale")
export class Sale extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("timestamp without time zone", { name: "bill_date" })
  billdate: Date;
  
  @Column("integer", { name: "customer_id"})
  customerid: number;

  @Column("character varying", { name: "status", nullable: true })
  status: string | null;
  
  @Column("character varying", { name: "paymode", nullable: true })
  paymode: string | null;

  @Column("character varying", { name: "payrefno", nullable: true })
  payrefno: string | null;

  @Column("double precision", { name: "total", precision: 53 })
  total: number;
  
  @Column("json", { name: "more_props", nullable: true })
  props: object | null;

  @ManyToOne(() => Customer, (customer) => customer.sales)
  @JoinColumn([{ name: "customer_id", referencedColumnName: "id" }])
  customer: Customer;

  @ManyToOne(() => AppUser, (user) => user.sales)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  created: AppUser;

  @OneToMany(() => SaleItem, (item) => item.sale)
  items: SaleItem[];

}