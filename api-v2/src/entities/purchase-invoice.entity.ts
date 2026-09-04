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

    @Column("date", { name: "due_date", nullable: true })
    duedate: string | null;

    @Column("character varying", { name: "payment_status", nullable: true })
    paymentstatus: string | null;

    @Column("character varying", { name: "reference_no", nullable: true })
    referenceno: string | null;

    @Column("double precision", { name: "total", precision: 53 })
    total: number;

    @Column("character varying", { name: "comments" })
    comments: string;

    @Column("character varying", { name: "notes", nullable: true })
    notes: string | null;
  
    @Column("integer", { name: "vendor_id" })
    vendorid: number;
    
    @Column("character varying", { name: "purchase_order_id" })
    purchaseorderid: string;

    @Column("character varying", { name: "supplier_gstin", length: 15, nullable: true })
    suppliergstin: string | null;

    @Column("character varying", { name: "place_of_supply", length: 2, nullable: true })
    placeofsupply: string | null;

    @Column("character varying", { name: "supply_type" })
    supplytype: string;

    @Column("character varying", { name: "invoice_type" })
    invoicetype: string;

    @Column("boolean", { name: "reverse_charge" })
    reversecharge: boolean;

    @Column("double precision", { name: "taxable_value", precision: 53, nullable: true })
    taxablevalue: number | null;

    @Column("double precision", { name: "cgst_amount", precision: 53 })
    cgstamount: number;

    @Column("double precision", { name: "sgst_amount", precision: 53 })
    sgstamount: number;

    @Column("double precision", { name: "igst_amount", precision: 53 })
    igstamount: number;

    @Column("double precision", { name: "cess_amount", precision: 53 })
    cessamount: number;

    @Column("double precision", { name: "round_off", precision: 53 })
    roundoff: number;

    @Column("character varying", { name: "itc_eligibility" })
    itceligibility: string;

    @Column("double precision", { name: "itc_reversal_amount", precision: 53 })
    itcreversalamount: number;

    @Column("character varying", { name: "gst_recon_status" })
    gstreconstatus: string;

    @Column("character varying", { name: "gst_period", length: 7, nullable: true })
    gstperiod: string | null;

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
  
