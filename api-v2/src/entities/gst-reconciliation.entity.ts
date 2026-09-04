import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("gst_reconciliation_pk", ["id"], { unique: true })
@Entity("gst_reconciliation")
export class GstReconciliation extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;

    @Column("integer", { name: "business_id" })
    businessid: number;

    @Column("character varying", { name: "period", length: 7 })
    period: string;

    @Column("integer", { name: "purchase_invoice_id", nullable: true })
    purchaseinvoiceid: number | null;

    @Column("integer", { name: "inward_supply_id", nullable: true })
    inwardsupplyid: number | null;

    @Column("character varying", { name: "match_type", nullable: true })
    matchtype: string | null;

    @Column("character varying", { name: "status" })
    status: string;

    @Column("jsonb", { name: "variances", nullable: true })
    variances: any;

    @Column("character varying", { name: "resolution_note", nullable: true })
    resolutionnote: string | null;

    @Column("integer", { name: "resolved_by", nullable: true })
    resolvedby: number | null;

    @Column("timestamp with time zone", { name: "resolved_at", nullable: true })
    resolvedat: Date | null;
}
