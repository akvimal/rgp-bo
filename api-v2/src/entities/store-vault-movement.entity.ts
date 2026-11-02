import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export type VaultMoveType = "OPENING" | "DROP_IN" | "BANK_DEPOSIT_OUT" | "CHANGE_TO_DRAWER" | "ADJUSTMENT";
export type VaultMoveStatus = "PENDING" | "CONFIRMED" | "REJECTED";

/** One movement in or out of a store's vault. The vault balance is derived from these rows (and store_vault_counts). */
@Index("store_vault_movements_pkey", ["id"], { unique: true })
@Entity("store_vault_movements")
export class StoreVaultMovement {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("integer", { name: "store_id" })
  storeid: number;

  @Column("integer", { name: "shift_id", nullable: true })
  shiftid: number | null;

  @Column("character varying", { name: "move_type", length: 20 })
  movetype: VaultMoveType;

  @Column("character varying", { name: "direction", length: 3 })
  direction: "IN" | "OUT";

  @Column("double precision", { name: "amount", precision: 53 })
  amount: number;

  @Column("jsonb", { name: "denominations", default: () => "'[]'" })
  denominations: Array<{ d: number; n: number }>;

  @Column("character varying", { name: "status", length: 10, default: "CONFIRMED" })
  status: VaultMoveStatus;

  @Column("integer", { name: "actor_id" })
  actorid: number;

  @Column("integer", { name: "confirmed_by", nullable: true })
  confirmedby: number | null;

  @Column("timestamptz", { name: "confirmed_on", nullable: true })
  confirmedon: Date | null;

  @Column("character varying", { name: "reference_no", length: 40, nullable: true })
  referenceno: string | null;

  @Column("character varying", { name: "reason", length: 200, nullable: true })
  reason: string | null;

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;

  @Column("timestamptz", { name: "created_on", default: () => "now()" })
  createdon: Date;
}
