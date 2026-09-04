import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("gst_return_period_pk", ["id"], { unique: true })
@Index("gst_return_period_un", ["businessid", "period"], { unique: true })
@Entity("gst_return_period")
export class GstReturnPeriod extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;

    @Column("integer", { name: "business_id" })
    businessid: number;

    @Column("character varying", { name: "period", length: 7 })
    period: string;

    @Column("character varying", { name: "status" })
    status: string;

    @Column("timestamp with time zone", { name: "gstr2b_imported_at", nullable: true })
    gstr2bimportedat: Date | null;

    @Column("timestamp with time zone", { name: "gstr2a_imported_at", nullable: true })
    gstr2aimportedat: Date | null;

    @Column("double precision", { name: "itc_available" })
    itcavailable: number;

    @Column("double precision", { name: "itc_claimed" })
    itcclaimed: number;

    @Column("double precision", { name: "itc_on_hold" })
    itconhold: number;

    @Column("double precision", { name: "itc_reversed" })
    itcreversed: number;

    @Column("character varying", { name: "notes", nullable: true })
    notes: string | null;
}
