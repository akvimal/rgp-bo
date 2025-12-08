import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { Tenant } from "./tenant.entity";
import { Business } from "./business.entity";
import { ProductStoreConfig } from "./product-store-config.entity";
import { SalesIntent } from "./sales-intent.entity";
import { PurchaseOrder } from "./purchase-order.entity";
import { PurchaseInvoice } from "./purchase-invoice.entity";
import { Sale } from "./sale.entity";
import { Shift } from "./shift.entity";
import { StoreCashAccount } from "./store-cash-account.entity";

@Index("store_pk", ["id"], { unique: true })
@Index("store_tenant_code_un", ["tenantId", "storeCode"], { unique: true })
@Entity("store")
export class Store {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;

    @Column("integer", { name: "tenant_id" })
    tenantId: number;

    @ManyToOne(() => Tenant, (tenant) => tenant.stores)
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @Column("character varying", { name: "store_code", length: 20 })
    storeCode: string;

    @Column("character varying", { name: "store_name", length: 100 })
    storeName: string;

    // Location Details
    @Column("text", { name: "address", nullable: true })
    address: string | null;

    @Column("character varying", { name: "city", length: 50, nullable: true })
    city: string | null;

    @Column("character varying", { name: "state", length: 50, nullable: true })
    state: string | null;

    @Column("character varying", { name: "pincode", length: 10, nullable: true })
    pincode: string | null;

    @Column("decimal", { name: "latitude", precision: 10, scale: 7, nullable: true })
    latitude: number | null;

    @Column("decimal", { name: "longitude", precision: 10, scale: 7, nullable: true })
    longitude: number | null;

    // Store Type & Status
    @Column("character varying", { name: "store_type", length: 30, default: 'BRANCH' })
    storeType: string;

    @Column("boolean", { name: "is_main_store", default: false })
    isMainStore: boolean;

    @Column("character varying", { name: "store_status", length: 20, default: 'ACTIVE' })
    storeStatus: string;

    // Contact Info
    @Column("character varying", { name: "manager_name", length: 100, nullable: true })
    managerName: string | null;

    @Column("character varying", { name: "contact_mobile", length: 15, nullable: true })
    contactMobile: string | null;

    @Column("character varying", { name: "contact_email", length: 100, nullable: true })
    contactEmail: string | null;

    // Operational Settings
    @Column("jsonb", { name: "settings", nullable: true })
    settings: object | null;

    // Standard Audit Columns
    @Column("boolean", { name: "active", default: true })
    active: boolean;

    @Column("boolean", { name: "archive", default: false })
    archive: boolean;

    @CreateDateColumn({ type: "timestamptz", name: "created_on" })
    createdOn: Date;

    @UpdateDateColumn({ type: "timestamptz", name: "updated_on" })
    updatedOn: Date;

    @Column("integer", { name: "created_by", nullable: true })
    createdBy: number | null;

    @Column("integer", { name: "updated_by", nullable: true })
    updatedBy: number | null;

    // Relations
    // Note: Business relation removed - new architecture uses Tenant instead
    // Property kept for TypeORM relation compatibility
    business: Business | null;

    @OneToMany(() => ProductStoreConfig, (config) => config.store)
    productConfigs: ProductStoreConfig[];

    @OneToMany(() => SalesIntent, (intent) => intent.store)
    salesIntents: SalesIntent[];

    @OneToMany(() => PurchaseOrder, (order) => order.store)
    purchaseOrders: PurchaseOrder[];

    @OneToMany(() => PurchaseInvoice, (invoice) => invoice.store)
    purchaseInvoices: PurchaseInvoice[];

    @OneToMany(() => Sale, (sale) => sale.store)
    sales: Sale[];

    @OneToMany(() => Shift, (shift) => shift.store)
    shifts: Shift[];

    @OneToMany(() => StoreCashAccount, (account) => account.store)
    transactions: StoreCashAccount[];
}