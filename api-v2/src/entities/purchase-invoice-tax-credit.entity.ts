import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { PurchaseInvoice } from "./purchase-invoice.entity";
import { Document } from "./document.entity";

@Index("tax_credit_pk", ["id"], { unique: true })
@Entity("purchase_invoice_tax_credit")
export class PurchaseInvoiceTaxCredit extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "invoice_id" })
  invoiceid: number;

  // GST Filing Details
  @Column("date", { name: "gst_filing_month" })
  gstfilingmonth: string;

  @Column("character varying", { name: "vendor_gstin", length: 15 })
  vendorgstin: string;

  // Tax Amounts
  @Column("numeric", { name: "taxable_amount", precision: 12, scale: 2 })
  taxableamount: number;

  @Column("numeric", { name: "cgst_amount", precision: 12, scale: 2, nullable: true })
  cgstamount: number;

  @Column("numeric", { name: "sgst_amount", precision: 12, scale: 2, nullable: true })
  sgstamount: number;

  @Column("numeric", { name: "igst_amount", precision: 12, scale: 2, nullable: true })
  igstamount: number;

  @Column("numeric", { name: "total_tax_credit", precision: 12, scale: 2 })
  totaltaxcredit: number;

  // Filing Status Tracking
  @Column("character varying", { name: "filing_status", default: 'PENDING' })
  filingstatus: string;

  @Column("date", { name: "filed_date", nullable: true })
  fileddate: string;

  @Column("date", { name: "reflected_in_2a_date", nullable: true })
  reflectedin2adate: string;

  @Column("character varying", { name: "claimed_in_return", nullable: true })
  claimedinreturn: string;

  @Column("date", { name: "claimed_date", nullable: true })
  claimeddate: string;

  // Mismatch Handling
  @Column("boolean", { name: "has_mismatch", default: false })
  hasmismatch: boolean;

  @Column("character varying", { name: "mismatch_reason", nullable: true })
  mismatchreason: string;

  @Column("numeric", { name: "mismatch_amount", precision: 12, scale: 2, nullable: true })
  mismatchamount: number;

  @Column("boolean", { name: "mismatch_resolved", default: false })
  mismatchresolved: boolean;

  @Column("text", { name: "mismatch_resolution_notes", nullable: true })
  mismatchresolutionnotes: string;

  // Supporting Documents
  @Column("integer", { name: "gstr1_doc_id", nullable: true })
  gstr1docid: number;

  @Column("integer", { name: "gstr2a_screenshot_id", nullable: true })
  gstr2ascreenshotid: number;

  // Verification
  @Column("integer", { name: "verified_by", nullable: true })
  verifiedby: number;

  @Column("timestamp with time zone", { name: "verified_on", nullable: true })
  verifiedon: Date;

  @Column("text", { name: "notes", nullable: true })
  notes: string;

  // Relations
  @ManyToOne(() => PurchaseInvoice)
  @JoinColumn([{ name: "invoice_id", referencedColumnName: "id" }])
  invoice: PurchaseInvoice;

  @ManyToOne(() => Document)
  @JoinColumn([{ name: "gstr1_doc_id", referencedColumnName: "id" }])
  gstr1document: Document;

  @ManyToOne(() => Document)
  @JoinColumn([{ name: "gstr2a_screenshot_id", referencedColumnName: "id" }])
  gstr2adocument: Document;
}
