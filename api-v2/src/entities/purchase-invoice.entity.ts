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

    @Column("character varying", { name: "status", default: 'NEW' })
    status: string;

    // Document Type
    @Column("character varying", { name: "doc_type", default: 'INVOICE' })
    doctype: string;

    // Payment Status
    @Column("character varying", { name: "payment_status", default: 'UNPAID' })
    paymentstatus: string;

    @Column("numeric", { name: "paid_amount", precision: 12, scale: 2, default: 0 })
    paidamount: number;

    // Tax Status
    @Column("character varying", { name: "tax_status", default: 'PENDING' })
    taxstatus: string;

    // Lifecycle Status
    @Column("character varying", { name: "lifecycle_status", default: 'OPEN' })
    lifecyclestatus: string;

    @Column("character varying", { name: "gr_no", nullable: true })
    grno: string;

    @Column("date", { name: "gr_date", nullable: true })
    grdate: string;

    @Column("double precision", { name: "total", precision: 53, nullable: true })
    total: number;

    @Column("character varying", { name: "comments", nullable: true })
    comments: string;

    @Column("integer", { name: "vendor_id", unique: true })
    vendorid: number;

    @Column("character varying", { name: "purchase_order_id", nullable: true })
    purchaseorderid: string;

    // Tax Amounts
    @Column("numeric", { name: "tax_amount", precision: 12, scale: 2, nullable: true })
    taxamount: number;

    @Column("numeric", { name: "cgst_amount", precision: 12, scale: 2, nullable: true })
    cgstamount: number;

    @Column("numeric", { name: "sgst_amount", precision: 12, scale: 2, nullable: true })
    sgstamount: number;

    @Column("numeric", { name: "igst_amount", precision: 12, scale: 2, nullable: true })
    igstamount: number;

    @Column("numeric", { name: "total_tax_credit", precision: 12, scale: 2, nullable: true })
    totaltaxcredit: number;

    // Tax Reconciliation
    @Column("date", { name: "tax_filing_month", nullable: true })
    taxfilingmonth: string;

    @Column("timestamp with time zone", { name: "tax_reconciled_on", nullable: true })
    taxreconciledon: Date;

    @Column("integer", { name: "tax_reconciled_by", nullable: true })
    taxreconciledby: number;

    // Closure
    @Column("timestamp with time zone", { name: "closed_on", nullable: true })
    closedon: Date;

    @Column("integer", { name: "closed_by", nullable: true })
    closedby: number;

    @Column("text", { name: "closure_notes", nullable: true })
    closurenotes: string;

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
