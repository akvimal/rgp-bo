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

@Index("product_price_pk", ["id"], { unique: true })
@Index("product_price_un", ["itemid"], { unique: true })
@Entity("product_price")
export class ProductPriceChange extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "item_id", unique: true })
  itemid: number;

  @Column("double precision", { name: "old_price", precision: 53 })
  oldprice: number;

  @Column("double precision", { name: "price", precision: 53 })
  price: number;

  @Column({ name: 'eff_date', type: 'date', default: () => 'CURRENT_DATE' })
  effdate: Date;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  @ManyToOne(
    () => PurchaseInvoiceItem,
    (purchase) => purchase.saleitems
  )
  @JoinColumn([{ name: "item_id", referencedColumnName: "id" }])
  purchaseitem: PurchaseInvoiceItem;
}
