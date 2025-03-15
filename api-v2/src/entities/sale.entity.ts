import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";
import { BaseEntity } from "./base.entity";
import { Customer } from "./customer.entity";
import { SaleDelivery } from "./sale-delivery.entity";
import { SaleItem } from "./sale-item.entity";

@Index("sale_pk", ["id"], { unique: true })
@Entity("sale")
export class Sale extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "bill_no", nullable: true })
  billno: number | null;
  @Column("integer", { name: "order_no", nullable: true })
  orderno: number | null;

  @Column("timestamp without time zone", { name: "bill_date" })
  billdate: Date;
  @Column("timestamp without time zone", { name: "order_date" })
  orderdate: Date;
  
  @Column("integer", { name: "customer_id"})
  customerid: number;  

  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "digi_method", nullable: true })
  digimethod: string | null;
  @Column("character varying", { name: "digi_refno", nullable: true })
  digirefno: string | null;

  @Column("double precision", { name: "digi_amount", precision: 53 })
  digiamt: number;
  @Column("double precision", { name: "cash_amount", precision: 53 })
  cashamt: number;

  @Column("double precision", { name: "disc_amount", precision: 53 })
  discamount: number;
  @Column("character varying", { name: "disc_code", nullable: true })
  disccode: string | null;

  @Column("character varying", { name: "order_type", nullable: true })
  ordertype: string | null;  
  @Column("character varying", { name: "delivery_type", nullable: true })
  deliverytype: string | null;
  
  @Column("double precision", { name: "total", precision: 53 })
  total: number;
  @Column("double precision", { name: "expreturn_days", precision: 53 })
  expreturndays: number;
  
  @Column("json", { name: "more_props", nullable: true })
  props: object | null;

  @Column({ name: 'doc_pending', type: 'boolean', default: false })
  docpending: boolean;

  @ManyToOne(() => Customer, (customer) => customer.sales)
  @JoinColumn([{ name: "customer_id", referencedColumnName: "id" }])
  customer: Customer;

  @ManyToOne(() => AppUser, (user) => user.sales)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  created: AppUser;

  @OneToMany(() => SaleItem, (item) => item.sale)
  items: SaleItem[];

  // @OneToMany(() => SaleDelivery, (item) => item.sale)
  // deliveries: SaleDelivery[];


  @OneToOne(() => SaleDelivery, (delivery) => delivery.sale)
    delivery: SaleDelivery

}
