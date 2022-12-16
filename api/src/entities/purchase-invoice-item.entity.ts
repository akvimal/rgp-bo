import {
    Column,
    Entity,
    Index,
    JoinColumn,
    OneToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
  } from "typeorm";
  import { PurchaseInvoice } from "./purchase-invoice.entity";
  import { Product } from "./product.entity";
import { BaseEntity } from "./base.entity";
import { SaleItem } from "./sale-item.entity";
  
  @Index("pur_invitem_un", ["batch", "invoiceid", "productid"], { unique: true })
  @Index("pur_invitem_pk", ["id"], { unique: true })
  @Entity("purchase_invoice_item", { schema: "pharma4" })
  export class PurchaseInvoiceItem extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("integer", { name: "invoice_id", unique: true })
    invoiceid: number;
  
    @Column("integer", { name: "product_id", unique: true })
    productid: number;
  
    @Column("character varying", { name: "batch", nullable: true, unique: true })
    batch: string | null;
  
    @Column("date", { name: "exp_date", nullable: true })
    expdate: string | null;
  
    @Column("double precision", { name: "ptr_cost", precision: 53 })
    ptrcost: number;
  
    @Column("double precision", { name: "mrp_cost", precision: 53 })
    mrpcost: number;
   
    @Column("double precision", {
      name: "tax_pcnt",
      nullable: true,
      precision: 53,
    })
    taxpcnt: number | null;

    @Column("double precision", {
      name: "sale_price",
      nullable: true,
      precision: 53,
    })
    saleprice: number | null;
  
    @Column("integer", { name: "qty" })
    qty: number;
  
    @Column("double precision", { name: "total", precision: 53 })
    total: number;

    @Column("character varying", { name: "comments" })
    comments: string | null;
    
    @Column("character varying", { name: "status" })
    status: string;

    @ManyToOne(
      () => PurchaseInvoice,
      (purchaseInvoice) => purchaseInvoice.items
    )
    @JoinColumn([{ name: "invoice_id", referencedColumnName: "id" }])
    invoice: PurchaseInvoice;
  
    @ManyToOne(() => Product, (product) => product.purchaseInvoiceItems)
    @JoinColumn([{ name: "product_id", referencedColumnName: "id" }])
    product: Product;

    @OneToMany(() => SaleItem, (saleItem) => saleItem.purchaseitem)
    saleitems: SaleItem[];
  }
  