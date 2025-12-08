import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { Store } from "./store.entity";
import { Product } from "./product.entity";
import { Vendor } from "./vendor.entity";

@Index("psc_pk", ["id"], { unique: true })
@Index("psc_store_product_un", ["storeId", "productId"], { unique: true })
@Entity("product_store_config")
export class ProductStoreConfig {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;

    @Column("integer", { name: "store_id" })
    storeId: number;

    @ManyToOne(() => Store, (store) => store.productConfigs)
    @JoinColumn({ name: "store_id" })
    store: Store;

    @Column("integer", { name: "product_id" })
    productId: number;

    @ManyToOne(() => Product)
    @JoinColumn({ name: "product_id" })
    product: Product;

    // Inventory Management
    @Column("integer", { name: "reorder_limit", default: 0 })
    reorderLimit: number;

    @Column("integer", { name: "min_stock_level", default: 0, nullable: true })
    minStockLevel: number | null;

    @Column("integer", { name: "max_stock_level", nullable: true })
    maxStockLevel: number | null;

    @Column("integer", { name: "optimal_stock_level", nullable: true })
    optimalStockLevel: number | null;

    // Purchasing Parameters
    @Column("integer", { name: "lead_time_days", default: 7 })
    leadTimeDays: number;

    @Column("integer", { name: "preferred_vendor_id", nullable: true })
    preferredVendorId: number | null;

    @ManyToOne(() => Vendor, { nullable: true })
    @JoinColumn({ name: "preferred_vendor_id" })
    preferredVendor: Vendor | null;

    // Store-Specific Flags
    @Column("boolean", { name: "is_available_in_store", default: true })
    isAvailableInStore: boolean;

    @Column("boolean", { name: "is_fast_moving", default: false })
    isFastMoving: boolean;

    // Store-Specific Pricing (optional override)
    @Column("decimal", { name: "store_price", precision: 10, scale: 2, nullable: true })
    storePrice: number | null;

    // Configuration Notes
    @Column("text", { name: "config_notes", nullable: true })
    configNotes: string | null;

    @Column("jsonb", { name: "settings", nullable: true })
    settings: object | null;

    // Standard Audit Columns
    @Column("boolean", { name: "active", default: true })
    active: boolean;

    @CreateDateColumn({ type: "timestamptz", name: "created_on" })
    createdOn: Date;

    @UpdateDateColumn({ type: "timestamptz", name: "updated_on" })
    updatedOn: Date;

    @Column("integer", { name: "created_by", nullable: true })
    createdBy: number | null;

    @Column("integer", { name: "updated_by", nullable: true })
    updatedBy: number | null;
}
