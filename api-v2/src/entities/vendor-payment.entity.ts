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
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { PurchaseInvoice } from "./purchase-invoice.entity";
import { Vendor } from "./vendor.entity";
  
@Index("vendor_payment_pk", ["id"], { unique: true })
@Index("vendor_payment_vendor_idx", ["vendorid"])
@Index("vendor_payment_invoice_idx", ["invoiceid"])
@Entity("vendor_payment")
export class VendorPayment extends BaseEntity {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("integer", { name: "vendor_id"})
    vendorid: number;

    @Column("integer", { name: "invoice_id"})
    invoiceid: number;
  
    @Column("date", { name: "pay_date" })
    paydate: string;

    @Column("double precision", { name: "amount", precision: 53 })
    amount: number;

    @Column("character varying", { name: "pay_mode" })
    paymode: string;
    
    @Column("character varying", { name: "trans_ref" })
    transref: string;

    @Column("character varying", { name: "communication_status", nullable: true })
    communicationstatus: string | null;

    @Column("character varying", { name: "communication_channel", nullable: true })
    communicationchannel: string | null;

    @Column("timestamp without time zone", { name: "communicated_at", nullable: true })
    communicatedat: Date | null;

    @Column("timestamp without time zone", { name: "acknowledged_at", nullable: true })
    acknowledgedat: Date | null;

    @Column("character varying", { name: "acknowledgement_reference", nullable: true })
    acknowledgementreference: string | null;

    @Column("character varying", { name: "remarks", nullable: true })
    remarks: string | null;
    
    @ManyToOne(
      () => Vendor,
      (vendor) => vendor.payments
    )
    @JoinColumn([{ name: "vendor_id", referencedColumnName: "id" }])
    vendor: Vendor;

    @ManyToOne(
      () => PurchaseInvoice,
      (invoice) => invoice.payments
    )
    @JoinColumn([{ name: "invoice_id", referencedColumnName: "id" }])
    invoice: PurchaseInvoice;
  }
  
