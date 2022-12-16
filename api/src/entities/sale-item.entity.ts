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
import { Sale } from "./sale.entity";

@Index("sale_item_pk", ["id"], { unique: true })
@Index("sale_item_un", ["itemid", "saleid"], { unique: true })
@Entity("sale_item", { schema: "pharma4" })
export class SaleItem extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "sale_id", unique: true })
  saleid: number;

  @Column("integer", { name: "purchase_item_id", unique: true })
  itemid: number;

  @Column("double precision", { name: "price", precision: 53 })
  price: number;

  @Column("integer", { name: "qty" })
  qty: number;
  
  @Column("double precision", { name: "total", precision: 53 })
  total: number;

  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  @ManyToOne(
    () => PurchaseInvoiceItem,
    (purchase) => purchase.saleitems
  )
  @JoinColumn([{ name: "purchase_item_id", referencedColumnName: "id" }])
  purchaseitem: PurchaseInvoiceItem;

  @ManyToOne(() => Sale, (sale) => sale.items)
  @JoinColumn([{ name: "sale_id", referencedColumnName: "id" }])
  sale: Sale;
}
