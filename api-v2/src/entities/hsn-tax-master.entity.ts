import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("hsn_tax_master_pkey", ["id"], { unique: true })
@Index("hsn_tax_master_unique", ["hsncode", "effectivefrom"], { unique: true })
@Index("idx_hsn_tax_active", ["hsncode", "effectiveto"], {
  where: "active = true"
})
@Index("idx_hsn_tax_dates", ["hsncode", "effectivefrom", "effectiveto"], {
  where: "active = true"
})
@Entity("hsn_tax_master")
export class HsnTaxMaster extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "hsn_code", length: 8, unique: true })
  hsncode: string;

  @Column("character varying", { name: "hsn_description", length: 200, nullable: true })
  hsndescription: string | null;

  @Column("numeric", { name: "cgst_rate", precision: 5, scale: 2 })
  cgstrate: number;

  @Column("numeric", { name: "sgst_rate", precision: 5, scale: 2 })
  sgstrate: number;

  @Column("numeric", { name: "igst_rate", precision: 5, scale: 2 })
  igstrate: number;

  @Column("date", { name: "effective_from", default: () => "CURRENT_DATE" })
  effectivefrom: Date;

  @Column("date", { name: "effective_to", default: () => "'2099-12-31'" })
  effectiveto: Date;

  @Column("character varying", { name: "tax_category", length: 50, nullable: true })
  taxcategory: string | null;

  // Computed property for total tax rate
  get totalTaxRate(): number {
    return Number(this.cgstrate) + Number(this.sgstrate);
  }
}
