import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** A count of the vault with the expected figure and the variance. Kept apart from shift (drawer) variances. */
@Index("store_vault_counts_pkey", ["id"], { unique: true })
@Entity("store_vault_counts")
export class StoreVaultCount {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("integer", { name: "store_id" })
  storeid: number;

  @Column("double precision", { name: "expected", precision: 53 })
  expected: number;

  @Column("double precision", { name: "counted", precision: 53 })
  counted: number;

  @Column("double precision", { name: "variance", precision: 53 })
  variance: number;

  @Column("jsonb", { name: "denominations", default: () => "'[]'" })
  denominations: Array<{ d: number; n: number }>;

  @Column("integer", { name: "counted_by" })
  countedby: number;

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;

  @Column("timestamptz", { name: "counted_on", default: () => "now()" })
  countedon: Date;
}
