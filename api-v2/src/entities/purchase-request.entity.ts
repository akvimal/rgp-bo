import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Product } from "./product.entity";
import { PurchaseOrder } from "./purchase-order.entity";
import { Vendor } from "./vendor.entity";

@Index("purchase_request_pk", ["id"], { unique: true })
@Index("purchase_request_product_idx", ["productid"])
@Index("purchase_request_order_idx", ["orderid"])
@Index("purchase_request_vendor_idx", ["vendorid"])
@Entity("purchase_request")
export class PurchaseRequest extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;
  
  @Column("integer", { name: "product_id" })
  productid: number;

  @Column("integer", { name: "order_id" })
  orderid: number;

  @Column("integer", { name: "vendor_id", nullable: true })
  vendorid: number | null;
  
  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "request_type", nullable: true })
  requesttype: string | null;

  @Column("character varying", { name: "source", nullable: true })
  source: string | null;

  @Column("character varying", { name: "priority", nullable: true })
  priority: string | null;
  
  @Column("integer", { name: "qty" })
  qty: number;

  @Column("integer", { name: "suggested_qty", nullable: true })
  suggestedqty: number | null;

  @Column("integer", { name: "ordered_qty", nullable: true })
  orderedqty: number | null;

  @Column("integer", { name: "fulfilled_qty", nullable: true })
  fulfilledqty: number | null;

  @Column("character varying", { name: "customer_name", nullable: true })
  customername: string | null;

  @Column("character varying", { name: "customer_phone", nullable: true })
  customerphone: string | null;

  @Column("date", { name: "needed_by", nullable: true })
  neededby: string | null;

  @Column("character varying", { name: "source_ref", nullable: true })
  sourceref: string | null;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  @Column("character varying", { name: "notes", nullable: true })
  notes: string | null;

  @ManyToOne(
    () => Product,
    (product) => product.requests
  )
  @JoinColumn([{ name: "product_id", referencedColumnName: "id" }])
  product: Product;

  @ManyToOne(
    () => PurchaseOrder,
    (po) => po.requests
  )
  @JoinColumn([{ name: "order_id", referencedColumnName: "id" }])
  po: PurchaseOrder;

  @ManyToOne(() => Vendor, (vendor) => vendor.purchaseRequests)
  @JoinColumn([{ name: "vendor_id", referencedColumnName: "id" }])
  vendor: Vendor;
}
