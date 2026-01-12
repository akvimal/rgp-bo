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

@Index("inv_doc_pk", ["id"], { unique: true })
@Entity("purchase_invoice_document")
export class PurchaseInvoiceDocument extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "invoice_id", nullable: true })
  invoiceid: number;

  @Column("integer", { name: "document_id" })
  documentid: number;

  // Document Classification
  @Column("character varying", { name: "doc_type", length: 50 })
  doctype: string;

  // OCR Processing
  @Column("character varying", { name: "ocr_status", default: 'PENDING' })
  ocrstatus: string;

  @Column("timestamp with time zone", { name: "ocr_processed_on", nullable: true })
  ocrprocessedon: Date;

  @Column("numeric", { name: "ocr_confidence_score", precision: 5, scale: 2, nullable: true })
  ocrconfidencescore: number;

  @Column("jsonb", { name: "ocr_extracted_data", nullable: true })
  ocrextracteddata: object;

  @Column("text", { name: "ocr_error_message", nullable: true })
  ocrerrormessage: string;

  // Auto-population
  @Column("boolean", { name: "auto_populated", default: false })
  autopopulated: boolean;

  @Column("character varying", { name: "auto_populate_status", nullable: true })
  autopopulatestatus: string;

  @Column("jsonb", { name: "field_mapping", nullable: true })
  fieldmapping: object;

  // Manual Review
  @Column("boolean", { name: "requires_review", default: false })
  requiresreview: boolean;

  @Column("integer", { name: "reviewed_by", nullable: true })
  reviewedby: number;

  @Column("timestamp with time zone", { name: "reviewed_on", nullable: true })
  reviewedon: Date;

  @Column("text", { name: "review_notes", nullable: true })
  reviewnotes: string;

  // Upload Metadata
  @Column("character varying", { name: "upload_source", length: 50, nullable: true })
  uploadsource: string;

  @Column("character varying", { name: "original_filename", nullable: true })
  originalfilename: string;

  // Relations
  @ManyToOne(() => PurchaseInvoice)
  @JoinColumn([{ name: "invoice_id", referencedColumnName: "id" }])
  invoice: PurchaseInvoice;

  @ManyToOne(() => Document)
  @JoinColumn([{ name: "document_id", referencedColumnName: "id" }])
  document: Document;
}
