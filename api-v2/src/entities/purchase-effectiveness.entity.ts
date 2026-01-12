import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { PurchaseInvoice } from "./purchase-invoice.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { Product } from "./product.entity";

@Index("eff_pk", ["id"], { unique: true })
@Index("eff_unique", ["invoiceitemid", "batch"], { unique: true })
@Entity("purchase_effectiveness")
export class PurchaseEffectiveness extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "invoice_id" })
  invoiceid: number;

  @Column("integer", { name: "invoice_item_id" })
  invoiceitemid: number;

  @Column("integer", { name: "product_id" })
  productid: number;

  @Column("character varying", { name: "batch", length: 50, nullable: true })
  batch: string;

  // Purchase Details
  @Column("integer", { name: "purchased_qty" })
  purchasedqty: number;

  @Column("integer", { name: "free_qty", default: 0 })
  freeqty: number;

  @Column("integer", { name: "total_received_qty" })
  totalreceivedqty: number;

  // Disposition Tracking
  @Column("integer", { name: "sold_qty", default: 0 })
  soldqty: number;

  @Column("integer", { name: "expired_qty", default: 0 })
  expiredqty: number;

  @Column("integer", { name: "returned_to_vendor_qty", default: 0 })
  returnedtovendorqty: number;

  @Column("integer", { name: "returned_by_customer_qty", default: 0 })
  returnedbycustomerqty: number;

  @Column("integer", { name: "lost_damaged_qty", default: 0 })
  lostdamagedqty: number;

  @Column("integer", { name: "adjusted_qty", default: 0 })
  adjustedqty: number;

  @Column("integer", { name: "current_stock_qty", default: 0 })
  currentstockqty: number;

  // Financial Impact
  @Column("numeric", { name: "purchase_value", precision: 12, scale: 2 })
  purchasevalue: number;

  @Column("numeric", { name: "sold_value", precision: 12, scale: 2, default: 0 })
  soldvalue: number;

  @Column("numeric", { name: "expired_value", precision: 12, scale: 2, default: 0 })
  expiredvalue: number;

  @Column("numeric", { name: "returned_value", precision: 12, scale: 2, default: 0 })
  returnedvalue: number;

  @Column("numeric", { name: "lost_value", precision: 12, scale: 2, default: 0 })
  lostvalue: number;

  // Effectiveness Metrics
  @Column("numeric", { name: "sellthrough_pcnt", precision: 5, scale: 2, nullable: true })
  sellthroughpcnt: number;

  @Column("numeric", { name: "wastage_pcnt", precision: 5, scale: 2, nullable: true })
  wastagepcnt: number;

  @Column("numeric", { name: "return_pcnt", precision: 5, scale: 2, nullable: true })
  returnpcnt: number;

  @Column("numeric", { name: "profit_amount", precision: 12, scale: 2, nullable: true })
  profitamount: number;

  @Column("numeric", { name: "roi_pcnt", precision: 5, scale: 2, nullable: true })
  roipcnt: number;

  // Timeline
  @Column("date", { name: "first_sale_date", nullable: true })
  firstsaledate: string;

  @Column("date", { name: "last_sale_date", nullable: true })
  lastsaledate: string;

  @Column("integer", { name: "days_to_first_sale", nullable: true })
  daystofirstsale: number;

  @Column("integer", { name: "days_to_sellout", nullable: true })
  daystosellout: number;

  // Status
  @Column("character varying", { name: "disposition_status", nullable: true })
  dispositionstatus: string;

  // Calculation Tracking
  @Column("timestamp with time zone", { name: "last_calculated_on", default: () => 'CURRENT_TIMESTAMP' })
  lastcalculatedon: Date;

  // Relations
  @ManyToOne(() => PurchaseInvoice)
  @JoinColumn([{ name: "invoice_id", referencedColumnName: "id" }])
  invoice: PurchaseInvoice;

  @ManyToOne(() => PurchaseInvoiceItem)
  @JoinColumn([{ name: "invoice_item_id", referencedColumnName: "id" }])
  invoiceitem: PurchaseInvoiceItem;

  @ManyToOne(() => Product)
  @JoinColumn([{ name: "product_id", referencedColumnName: "id" }])
  product: Product;
}
