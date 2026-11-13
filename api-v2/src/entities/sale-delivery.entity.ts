import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Sale } from "./sale.entity";

@Index("sale_deliveries_pk", ["id"], { unique: true })
@Entity("sale_deliveries")
export class SaleDelivery extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "saleId", unique: true })
  saleId: number;

  @Column("integer", { name: "booked_by", nullable: true })
  bookedby: number | null;
  @Column("date", { name: "booked_date", nullable: true })
  bookeddate: string | null;

  @Column("character varying", { name: "receiver_name", nullable: true })
  receivername: string | null;
  @Column("character varying", { name: "receiver_phone", nullable: true })
  receiverphone: string | null;
  @Column("character varying", { name: "receiver_address", nullable: true })
  receiveraddress: string | null;
  
  @Column("date", { name: "delivery_date", nullable: true })
  deliverydate: string | null;
  @Column("character varying", { name: "delivery_by", nullable: true })
  deliveryby: string | null;

  @Column("character varying", { name: "delivery_method", nullable: true })
  deliverymethod: string | null;
  @Column("character varying", { name: "courier_partner", nullable: true })
  courierpartner: string | null;
  @Column("timestamp without time zone", { name: "delivered_at", nullable: true })
  deliveredat: Date | null;
  @Column("boolean", { name: "confirmed", default: false })
  confirmed: boolean;
  @Column("character varying", { name: "confirmed_by", nullable: true })
  confirmedby: string | null;
  @Column("timestamp without time zone", { name: "confirmed_at", nullable: true })
  confirmedat: Date | null;

  @Column("double precision", { name: "charges", precision: 53, nullable: true })
  charges: number | null;
  @Column("double precision", { name: "actual_cost", precision: 53, nullable: true })
  actualcost: number | null;

  @Column("character varying", { name: "status", nullable: true })
  status: string | null;
  @Column("character varying", { name: "payment_mode", nullable: true })
  paymentmode: string | null;
  @Column("character varying", { name: "collection_status", nullable: true })
  collectionstatus: string | null;
  @Column("character varying", { name: "failure_reason", nullable: true })
  failurereason: string | null;
  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  // how the customer paid the delivery charge (migration 189): a digital charge counts in the digital takings of the shift of the sale
  @Column("character varying", { name: "charge_via", nullable: true })
  chargevia: string | null;
  @Column("character varying", { name: "charge_method", nullable: true })
  chargemethod: string | null;
  @Column("character varying", { name: "charge_ref", nullable: true })
  chargeref: string | null;

  // what the delivery cost and how it was paid (migration 179)
  @Column("character varying", { name: "cost_paid_via", nullable: true })
  costpaidvia: string | null;
  @Column("character varying", { name: "cost_paid_mode", nullable: true })
  costpaidmode: string | null;
  @Column("character varying", { name: "cost_paid_ref", nullable: true })
  costpaidref: string | null;
  @Column("timestamp with time zone", { name: "cost_paid_on", nullable: true })
  costpaidon: Date | null;
  @Column("integer", { name: "cost_paid_by", nullable: true })
  costpaidby: number | null;
  @Column("integer", { name: "cash_entry_id", nullable: true })
  cashentryid: number | null;
  @Column("integer", { name: "expense_id", nullable: true })
  expenseid: number | null;
  @Column("boolean", { name: "cost_linked", default: false })
  costlinked: boolean;
  @Column("integer", { name: "confirmed_by_user", nullable: true })
  confirmedbyuser: number | null;

  // @ManyToOne(() => Sale, (sale) => sale.deliveries, { onDelete: 'CASCADE' })
  // @JoinColumn([{ name: "sale_id", referencedColumnName: "id" }])
  // sale: Sale;

    
  @OneToOne(() => Sale, (sale) => sale.delivery)
  @JoinColumn([{ name: "saleId", referencedColumnName: "id" }])
  sale: Sale;
}
