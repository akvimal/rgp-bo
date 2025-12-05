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
import { ProductClearance } from "./product-clearance.entity";
  
  @Index("pur_invitem_un", ["batch", "invoiceid", "productid"], { unique: true })
  @Index("pur_invitem_pk", ["id"], { unique: true })
  @Entity("purchase_invoice_item")
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
    @Column("date", { name: "mfr_date", nullable: true })
    mfrdate: string | null;
  
    @Column("double precision", { name: "ptr_value", precision: 53 })
    ptrvalue: number;
    @Column("double precision", { name: "ptr_cost", precision: 53 })
    ptrcost: number;
    @Column("double precision", { name: "sale_price", precision: 53 })
    saleprice: number;
    @Column("double precision", { name: "mrp_cost", precision: 53 })
    mrpcost: number;
   
    @Column("double precision", { name: "disc_pcnt", precision: 53 })
    discpcnt: number;
   
    @Column("double precision", {
      name: "tax_pcnt",
      nullable: true,
      precision: 53,
    })
    taxpcnt: number | null;
  
    @Column("integer", { name: "qty" })
    qty: number;
    @Column("integer", { name: "free_qty" })
    freeqty: number;

    @Column("double precision", { name: "total", precision: 53 })
    total: number;

    @Column("character varying", { name: "comments", nullable: true })
    comments: string | null;

    @Column("character varying", { name: "status", default: 'NEW' })
    status: string;

    // Item Type
    @Column("character varying", { name: "item_type", default: 'REGULAR' })
    itemtype: string;

    @Column("character varying", { name: "challan_ref", nullable: true })
    challanref: string;

    @Column("character varying", { name: "return_reason", nullable: true })
    returnreason: string;

    // Tax Breakdown
    @Column("numeric", { name: "cgst_pcnt", precision: 5, scale: 2, nullable: true })
    cgstpcnt: number;

    @Column("numeric", { name: "sgst_pcnt", precision: 5, scale: 2, nullable: true })
    sgstpcnt: number;

    @Column("numeric", { name: "igst_pcnt", precision: 5, scale: 2, nullable: true })
    igstpcnt: number;

    @Column("numeric", { name: "cgst_amount", precision: 12, scale: 2, nullable: true })
    cgstamount: number;

    @Column("numeric", { name: "sgst_amount", precision: 12, scale: 2, nullable: true })
    sgstamount: number;

    @Column("numeric", { name: "igst_amount", precision: 12, scale: 2, nullable: true })
    igstamount: number;

    @Column({ name: 'verified_by', type: 'integer', nullable: true })
    verifiedby: number;
    @Column({ name: 'verify_start_date', type: 'date', nullable: true })
    verifystartdate: Date;
    @Column({ name: 'verify_end_date', type: 'date', nullable: true })
    verifyenddate: Date;
    
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

    // @OneToMany(() => ProductClearance, (clearance) => clearance.purchaseitem)
    // clearanceitem: ProductClearance[];
  }
  