import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Product } from './product.entity';
import { Customer } from './customer.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { AppUser } from './appuser.entity';
import { Store } from './store.entity';
import { SalesIntentItem } from './sales-intent-item.entity';

export enum IntentType {
    CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
    LOW_STOCK = 'LOW_STOCK',
    MARKET_DEMAND = 'MARKET_DEMAND',
    OTHER = 'OTHER'
}

export enum Priority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export enum IntentStatus {
    PENDING = 'PENDING',
    IN_PO = 'IN_PO',
    FULFILLED = 'FULFILLED',
    CANCELLED = 'CANCELLED'
}

export enum FulfillmentStatus {
    NOT_STARTED = 'NOT_STARTED',
    PO_CREATED = 'PO_CREATED',
    GOODS_RECEIVED = 'GOODS_RECEIVED',
    CUSTOMER_NOTIFIED = 'CUSTOMER_NOTIFIED',
    DELIVERED = 'DELIVERED'
}

@Entity('sales_intent')
export class SalesIntent {
    @PrimaryGeneratedColumn()
    id: number;

    // Intent Details
    @Column({ type: 'varchar', length: 50, unique: true })
    intentno: string;

    @Column({ type: 'enum', enum: IntentType })
    intenttype: IntentType;

    @Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM })
    priority: Priority;

    // Product Information
    @Column({ type: 'int', nullable: true })
    prodid: number;

    @ManyToOne(() => Product, { nullable: true })
    @JoinColumn({ name: 'prodid' })
    product: Product;

    @Column({ type: 'varchar', length: 100 })
    productname: string;

    @Column({ type: 'int' })
    requestedqty: number;

    // Line Items (Multiple Products)
    @OneToMany(() => SalesIntentItem, (item) => item.intent, { cascade: true })
    items: SalesIntentItem[];

    // Summary columns
    @Column({ type: 'int', default: 0, name: 'total_items' })
    totalitems: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_estimated_cost' })
    totalestimatedcost: number;

    // Customer Information (optional)
    @Column({ type: 'int', nullable: true })
    customerid: number;

    @ManyToOne(() => Customer, { nullable: true })
    @JoinColumn({ name: 'customerid' })
    customer: Customer;

    @Column({ type: 'varchar', length: 100, nullable: true })
    customername: string;

    @Column({ type: 'varchar', length: 15, nullable: true })
    customermobile: string;

    // Financial Details (optional)
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
    advanceamount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    estimatedcost: number;

    // Status and Workflow
    @Column({ type: 'enum', enum: IntentStatus, default: IntentStatus.PENDING })
    status: IntentStatus;

    @Column({ type: 'enum', enum: FulfillmentStatus, default: FulfillmentStatus.NOT_STARTED })
    fulfillmentstatus: FulfillmentStatus;

    // Notes and Comments
    @Column({ type: 'text', nullable: true })
    requestnotes: string;

    @Column({ type: 'text', nullable: true })
    internalnotes: string;

    // Fulfillment Tracking
    @Column({ type: 'int', nullable: true })
    purchaseorderid: number;

    @ManyToOne(() => PurchaseOrder, { nullable: true })
    @JoinColumn({ name: 'purchaseorderid' })
    purchaseorder: PurchaseOrder;

    @Column({ type: 'timestamptz', nullable: true })
    fulfilledon: Date;

    @Column({ type: 'timestamptz', nullable: true })
    notifiedon: Date;

    @Column({ type: 'timestamptz', nullable: true })
    deliveredon: Date;

    // Store Association
    @Column({ type: 'int', nullable: true, name: 'store_id' })
    storeid: number;

    @ManyToOne(() => Store, (store) => store.salesIntents, { nullable: true })
    @JoinColumn({ name: 'store_id' })
    store: Store;

    // Standard Audit Columns
    @Column({ type: 'boolean', default: true })
    active: boolean;

    @Column({ type: 'boolean', default: false })
    archive: boolean;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_on' })
    createdon: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_on' })
    updatedon: Date;

    @Column({ type: 'int', nullable: true, name: 'created_by' })
    createdby: number;

    @ManyToOne(() => AppUser, { nullable: true })
    @JoinColumn({ name: 'created_by' })
    createdbyuser: AppUser;

    @Column({ type: 'int', nullable: true, name: 'updated_by' })
    updatedby: number;

    @ManyToOne(() => AppUser, { nullable: true })
    @JoinColumn({ name: 'updated_by' })
    updatedbyuser: AppUser;
}
