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
  
    @Column("integer", { name: "vendor_id", unique: true })
    vendorid: number;

    @ManyToOne(() => Vendor, (vendor) => vendor.purchaseInvoices)
    @JoinColumn([{ name: "vendor_id", referencedColumnName: "id" }])
    vendor: Vendor;

    @OneToMany(
      () => PurchaseRequest,
      (request) => request.po
    )
    requests: PurchaseRequest[];
}
  