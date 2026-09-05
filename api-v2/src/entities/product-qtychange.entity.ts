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
import { Store } from "./store.entity";

@Index("product_qtychange_pk", ["id"], { unique: true })
@Entity("product_qtychange")
export class ProductQtyChange extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "item_id"})
  itemid: number;

  @Column("integer", { name: "qty"})
  qty: number;

  @Column("double precision", { name: "sale_price", precision: 53 })
  price: number;

  @Column("character varying", { name: "reason", nullable: true })
  reason: string | null;
  
  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  @Column("character varying", { name: "reason_code", length: 20, nullable: true })
  reasoncode: string | null;

  @Column("integer", { name: "store_id", nullable: true })
  storeid: number | null;

  @Column("integer", { name: "transfer_id", nullable: true })
  transferid: number | null;

  @Column("integer", { name: "count_id", nullable: true })
  countid: number | null;

  @ManyToOne(
    () => PurchaseInvoiceItem,
    (purchase) => purchase.saleitems
  )
  @JoinColumn([{ name: "item_id", referencedColumnName: "id" }])
  purchaseitem: PurchaseInvoiceItem;

  @ManyToOne(() => Store, { nullable: true })
  @JoinColumn([{ name: "store_id", referencedColumnName: "id" }])
  store: Store | null;
}
