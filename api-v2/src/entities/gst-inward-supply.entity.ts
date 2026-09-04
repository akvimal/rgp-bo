import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("gst_inward_supply_pk", ["id"], { unique: true })
@Entity("gst_inward_supply")
export class GstInwardSupply extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;

    @Column("integer", { name: "business_id" })
    businessid: number;

    @Column("character varying", { name: "period", length: 7 })
    period: string;

    @Column("character varying", { name: "source" })
    source: string;

    @Column("character varying", { name: "supplier_gstin", length: 15, nullable: true })
    suppliergstin: string | null;

    @Column("character varying", { name: "supplier_name", nullable: true })
    suppliername: string | null;

    @Column("character varying", { name: "invoice_no" })
    invoiceno: string;

    @Column("date", { name: "invoice_date", nullable: true })
    invoicedate: string | null;

    @Column("double precision", { name: "invoice_value" })
    invoicevalue: number;

    @Column("double precision", { name: "taxable_value" })
    taxablevalue: number;

    @Column("double precision", { name: "cgst" })
    cgst: number;

    @Column("double precision", { name: "sgst" })
    sgst: number;

    @Column("double precision", { name: "igst" })
    igst: number;

    @Column("double precision", { name: "cess" })
    cess: number;

    @Column("character varying", { name: "place_of_supply", length: 2, nullable: true })
    placeofsupply: string | null;

    @Column("boolean", { name: "reverse_charge" })
    reversecharge: boolean;

    @Column("character varying", { name: "itc_availability", nullable: true })
    itcavailability: string | null;

    @Column("character varying", { name: "filing_status", nullable: true })
    filingstatus: string | null;

    @Column("character varying", { name: "filing_period", length: 7, nullable: true })
    filingperiod: string | null;

    @Column("character varying", { name: "import_batch" })
    importbatch: string;

    @Column("jsonb", { name: "raw", nullable: true })
    raw: any;

    @Column("integer", { name: "matched_invoice_id", nullable: true })
    matchedinvoiceid: number | null;
}
