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
import { Product } from "./product.entity";
import { Vendor } from "./vendor.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { BatchMovementLog } from "./batch-movement-log.entity";

@Index("unique_product_batch_expiry", ["productId", "batchNumber", "expiryDate"], { unique: true })
@Index("idx_batch_product_expiry", ["productId", "expiryDate"])
@Index("idx_batch_status_expiry", ["status", "expiryDate"])
@Entity("product_batch")
export class ProductBatch extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  // Product reference
  @Column("integer", { name: "product_id" })
  productId: number;

  // Batch identification
  @Column("varchar", { name: "batch_number", length: 50 })
  batchNumber: string;

  @Column("date", { name: "expiry_date" })
  expiryDate: Date;

  @Column("date", { name: "manufactured_date", nullable: true })
  manufacturedDate: Date | null;

  // Quantity tracking
  @Column("integer", { name: "quantity_received" })
  quantityReceived: number;

  @Column("integer", { name: "quantity_remaining", default: 0 })
  quantityRemaining: number;

  // Purchase reference
  @Column("integer", { name: "purchase_invoice_item_id", nullable: true })
  purchaseInvoiceItemId: number | null;

  @Column("integer", { name: "vendor_id", nullable: true })
  vendorId: number | null;

  @Column("numeric", { name: "ptr_cost", precision: 10, scale: 2, nullable: true })
  ptrCost: number | null;

  // Metadata
  @Column("date", { name: "received_date", default: () => "CURRENT_DATE" })
  receivedDate: Date;

  @Column("varchar", { name: "status", length: 20, default: "ACTIVE" })
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'RECALLED';

  // Relations
  @ManyToOne(() => Product, (product) => product.batches)
  @JoinColumn([{ name: "product_id", referencedColumnName: "id" }])
  product: Product;

  @ManyToOne(() => Vendor)
  @JoinColumn([{ name: "vendor_id", referencedColumnName: "id" }])
  vendor: Vendor;

  @ManyToOne(() => PurchaseInvoiceItem)
  @JoinColumn([{ name: "purchase_invoice_item_id", referencedColumnName: "id" }])
  purchaseInvoiceItem: PurchaseInvoiceItem;

  @OneToMany(() => BatchMovementLog, (movement) => movement.batch)
  movements: BatchMovementLog[];
}
