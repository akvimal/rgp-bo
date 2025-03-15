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

@Index("purchase_request_pk", ["id"], { unique: true })
@Entity("purchase_request")
export class PurchaseRequest extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;
  
  @Column("integer", { name: "product_id" })
  productid: number;

  @Column("integer", { name: "order_id" })
  orderid: number;
  
  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "request_type", nullable: true })
  requesttype: string | null;
  
  @Column("integer", { name: "qty" })
  qty: number;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

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
}
