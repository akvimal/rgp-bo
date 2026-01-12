import {
    Column,
    Entity,
    Index,
    OneToMany,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { Store } from "./store.entity";

@Index("tenant_pk", ["id"], { unique: true })
@Index("tenant_code_un", ["tenantCode"], { unique: true })
@Entity("tenant")
export class Tenant {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;

    @Column("character varying", { name: "tenant_code", unique: true, length: 20 })
    tenantCode: string;

    @Column("character varying", { name: "tenant_name", length: 100 })
    tenantName: string;

    // Subscription Info
    @Column("character varying", { name: "subscription_plan", length: 50, nullable: true })
    subscriptionPlan: string | null;

    @Column("character varying", { name: "subscription_status", length: 20, default: 'ACTIVE' })
    subscriptionStatus: string;

    @Column({ name: "subscription_start_date", type: "date", nullable: true })
    subscriptionStartDate: Date | null;

    @Column({ name: "subscription_end_date", type: "date", nullable: true })
    subscriptionEndDate: Date | null;

    // Contact Info
    @Column("character varying", { name: "primary_contact_name", length: 100, nullable: true })
    primaryContactName: string | null;

    @Column("character varying", { name: "primary_contact_email", length: 100, nullable: true })
    primaryContactEmail: string | null;

    @Column("character varying", { name: "primary_contact_mobile", length: 15, nullable: true })
    primaryContactMobile: string | null;

    // Settings
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
    @OneToMany(() => Store, (store) => store.tenant)
    stores: Store[];
}
