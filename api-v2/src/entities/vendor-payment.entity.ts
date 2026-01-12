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
import { PurchaseInvoice } from "./purchase-invoice.entity";
import { Vendor } from "./vendor.entity";
  
@Index("vendor_payment_pk", ["id"], { unique: true })
@Entity("vendor_payment")
export class VendorPayment extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("integer", { name: "vendor_id"})
    vendorid: number;

    @Column("integer", { name: "invoice_id"})
    invoiceid: number;
  
    @Column("date", { name: "pay_date" })
    paydate: string;

    @Column("double precision", { name: "amount", precision: 53 })
    amount: number;

    @Column("character varying", { name: "pay_mode", nullable: true })
    paymode: string;

    @Column("character varying", { name: "trans_ref", nullable: true })
    transref: string;

    // Enhanced Payment Tracking
    @Column("character varying", { name: "payment_type", default: 'FULL' })
    paymenttype: string;

    @Column("character varying", { name: "payment_against", default: 'INVOICE' })
    paymentagainst: string;

    @Column("character varying", { name: "payment_status", default: 'COMPLETED' })
    paymentstatus: string;

    // Payment Details
    @Column("character varying", { name: "bank_name", nullable: true })
    bankname: string;

    @Column("character varying", { name: "cheque_no", nullable: true })
    chequeno: string;

    @Column("character varying", { name: "utr_no", nullable: true })
    utrno: string;

    @Column("integer", { name: "payment_proof_doc_id", nullable: true })
    paymentproofdocid: number;

    // Reconciliation
    @Column("boolean", { name: "reconciled", default: false })
    reconciled: boolean;

    @Column("timestamp with time zone", { name: "reconciled_on", nullable: true })
    reconciledon: Date;

    @Column("integer", { name: "reconciled_by", nullable: true })
    reconciledby: number;

    @Column("text", { name: "notes", nullable: true })
    notes: string;

    @ManyToOne(
      () => Vendor,
      (vendor) => vendor.payments
    )
    @JoinColumn([{ name: "vendor_id", referencedColumnName: "id" }])
    vendor: Vendor;

    @ManyToOne(
      () => PurchaseInvoice,
      (invoice) => invoice.payments
    )
    @JoinColumn([{ name: "invoice_id", referencedColumnName: "id" }])
    invoice: PurchaseInvoice;
  }
