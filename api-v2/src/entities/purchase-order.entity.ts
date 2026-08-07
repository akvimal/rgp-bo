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
import { PurchaseRequest } from "./purchase-request.entity";
  import { Vendor } from "./vendor.entity";
  
  @Index("purchase_order_pk", ["id"], { unique: true })
  @Index("purchase_order_vendor_idx", ["vendorid"])
  @Entity("purchase_order")
  export class PurchaseOrder extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "status" })
    status: string;
    
    @Column("character varying", { name: "comments" })
    comments: string;

    @Column("character varying", { name: "po_number" })
    ponumber: string;

    @Column("date", { name: "expected_date", nullable: true })
    expecteddate: string | null;

    @Column("character varying", { name: "source_summary", nullable: true })
    sourcesummary: string | null;

    @Column("character varying", { name: "approval_status", nullable: true })
    approvalstatus: string | null;

    @Column("character varying", { name: "approval_reason", nullable: true, length: 400 })
    approvalreason: string | null;

    @Column("integer", { name: "approval_requested_by", nullable: true })
    approvalrequestedby: number | null;

    @Column("timestamptz", { name: "approval_requested_at", nullable: true })
    approvalrequestedat: Date | null;

    @Column("integer", { name: "approved_by", nullable: true })
    approvedby: number | null;

    @Column("timestamptz", { name: "approved_at", nullable: true })
    approvedat: Date | null;

    @Column("integer", { name: "rejected_by", nullable: true })
    rejectedby: number | null;

    @Column("timestamptz", { name: "rejected_at", nullable: true })
    rejectedat: Date | null;

    @Column("character varying", { name: "rejection_reason", nullable: true, length: 400 })
    rejectionreason: string | null;
  
    @Column("integer", { name: "vendor_id" })
    vendorid: number;

    @ManyToOne(() => Vendor, (vendor) => vendor.purchaseOrders)
    @JoinColumn([{ name: "vendor_id", referencedColumnName: "id" }])
    vendor: Vendor;

    @OneToMany(
      () => PurchaseRequest,
      (request) => request.po
    )
    requests: PurchaseRequest[];
}
  
