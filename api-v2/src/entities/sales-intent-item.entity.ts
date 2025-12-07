import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SalesIntent } from './sales-intent.entity';
import { Product } from './product.entity';
import { AppUser } from './appuser.entity';

@Entity('sales_intent_item')
export class SalesIntentItem {
    @PrimaryGeneratedColumn()
    id: number;

    // Link to parent intent
    @Column({ type: 'int', name: 'intent_id' })
    intentid: number;

    @ManyToOne(() => SalesIntent, (intent) => intent.items)
    @JoinColumn({ name: 'intent_id' })
    intent: SalesIntent;

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

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    estimatedcost: number;

    // Notes specific to this item
    @Column({ type: 'text', nullable: true, name: 'item_notes' })
    itemnotes: string;

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
