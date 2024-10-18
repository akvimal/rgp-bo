import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { BaseEntity } from "./base.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { VendorPayment } from "./vendor-payment.entity";
  import { Vendor } from "./vendor.entity";
  
  @Index("purchase_invoice_pk", ["id"], { unique: true })
  @Index("purchase_invoice_un", ["invoiceno", "vendorid"], { unique: true })
  @Entity("purchase_invoice")
  export class PurchaseInvoice extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "invoice_no", unique: true })
    invoiceno: string;
  
    @Column("date", { name: "invoice_date" })
    invoicedate: string;

    @Column("character varying", { name: "status" })
    status: string;
    
    @Column("character varying", { name: "gr_no" })
    grno: string;

    @Column("double precision", { name: "total", precision: 53 })
    total: number;

    @Column("character varying", { name: "comments" })
    comments: string;
  
    @Column("integer", { name: "vendor_id", unique: true })
    vendorid: number;
    
    @Column("character varying", { name: "purchase_order_id" })
    purchaseorderid: string;
    
    @ManyToOne(() => Vendor, (vendor) => vendor.purchaseInvoices)
    @JoinColumn([{ name: "vendor_id", referencedColumnName: "id" }])
    vendor: Vendor;
  
    @OneToMany(
      () => PurchaseInvoiceItem,
      (purchaseInvoiceItem) => purchaseInvoiceItem.invoice
    )
    items: PurchaseInvoiceItem[];

    @OneToMany(() => VendorPayment, (vendorPayment) => vendorPayment.invoice)
    payments: VendorPayment[];
  }
  