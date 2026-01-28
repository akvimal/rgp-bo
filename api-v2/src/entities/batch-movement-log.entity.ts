import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ProductBatch } from "./product-batch.entity";
import { AppUser } from "./appuser.entity";

@Index("idx_batch_movement_batch", ["batchId", "performedAt"])
@Index("idx_batch_movement_type", ["movementType", "performedAt"])
@Index("idx_batch_movement_reference", ["referenceType", "referenceId"])
@Entity("batch_movement_log")
export class BatchMovementLog {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  // Batch reference
  @Column("integer", { name: "batch_id" })
  batchId: number;

  // Movement details
  @Column("varchar", { name: "movement_type", length: 50 })
  movementType: 'RECEIVED' | 'SOLD' | 'ADJUSTED' | 'RETURNED' | 'EXPIRED' | 'RECALLED';

  @Column("integer", { name: "quantity" })
  quantity: number;

  // Reference to source transaction
  @Column("varchar", { name: "reference_type", length: 50, nullable: true })
  referenceType: string | null;

  @Column("integer", { name: "reference_id", nullable: true })
  referenceId: number | null;

  // Audit trail (immutable)
  @Column("integer", { name: "performed_by", nullable: true })
  performedBy: number | null;

  @Column("timestamp with time zone", {
    name: "performed_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  performedAt: Date;

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;

  // Relations
  @ManyToOne(() => ProductBatch, (batch) => batch.movements)
  @JoinColumn([{ name: "batch_id", referencedColumnName: "id" }])
  batch: ProductBatch;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "performed_by", referencedColumnName: "id" }])
  performedByUser: AppUser;
}
