import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";

@Index("product_clearance_pk", ["id"], { unique: true })
@Entity("product_clearance")
export class ProductClearance extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "purchase_item_id"})
  itemid: number;

  @Column("integer", { name: "qty"})
  qty: number;

  @Column("double precision", { name: "price", precision: 53 })
  price: number;

  @Column("character varying", { name: "reason", nullable: true })
  reason: string | null;
  
  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  @ManyToOne(
    () => PurchaseInvoiceItem,
    (purchase) => purchase.clearanceitem
  )
  @JoinColumn([{ name: "purchase_item_id", referencedColumnName: "id" }])
  purchaseitem: PurchaseInvoiceItem;
}
