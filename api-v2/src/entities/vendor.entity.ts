import {
    Column,
    Entity,
    Index, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { BaseEntity } from "./base.entity";
import { PurchaseInvoice } from "./purchase-invoice.entity";
import { PurchaseOrder } from "./purchase-order.entity";
import { PurchaseRequest } from "./purchase-request.entity";
import { VendorPayment } from "./vendor-payment.entity";
  
  @Index("vendor_pk", ["id"], { unique: true })
  @Index("vendor_un", ["name"], { unique: true })
  @Entity("vendor")

  export class Vendor extends BaseEntity {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "business_name", unique: true, length: 40 })
    name: string;
    
    @Column("character varying", { name: "contact_name", length: 40 })
    contactname: string;
    
    @Column("character varying", { name: "contact_phone", length: 40 })
    contactphone: string;
    
    @Column("character varying", { name: "address", length: 200 })
    address: string;
    
    @Column("character varying", { name: "gstn", length: 40 })
    gstn: string;    
    
    @Column("character varying", { name: "comments", length: 400 })
    comments: string;
    
    @Column("json", { name: "more_props", nullable: true })
    props: object | null;

    @Column("integer", { name: "payment_terms_days", default: 0 })
    paymenttermsdays: number;

    @Column("character varying", { name: "legal_name", length: 120, nullable: true })
    legalname: string | null;

    @Column("character varying", { name: "vendor_type", length: 20, nullable: true })
    vendortype: string | null;

    @Column("character varying", { name: "registration_type", length: 20, default: "UNKNOWN" })
    registrationtype: string;

    @Column("character varying", { name: "pan", length: 10, nullable: true })
    pan: string | null;

    @Column("character varying", { name: "state_code", length: 2, nullable: true })
    statecode: string | null;

    @Column("character varying", { name: "city", length: 60, nullable: true })
    city: string | null;

    @Column("character varying", { name: "pincode", length: 6, nullable: true })
    pincode: string | null;

    @Column("character varying", { name: "email", length: 120, nullable: true })
    email: string | null;

    @Column("character varying", { name: "mobile", length: 15, nullable: true })
    mobile: string | null;

    @Column("character varying", { name: "rep_name", length: 60, nullable: true })
    repname: string | null;

    @Column("character varying", { name: "rep_phone", length: 15, nullable: true })
    repphone: string | null;

    @Column("character varying", { name: "bank_name", length: 80, nullable: true })
    bankname: string | null;

    @Column("character varying", { name: "bank_account", length: 30, nullable: true })
    bankaccount: string | null;

    @Column("character varying", { name: "bank_ifsc", length: 11, nullable: true })
    bankifsc: string | null;

    @Column("character varying", { name: "upi_id", length: 80, nullable: true })
    upiid: string | null;

    @Column("numeric", { name: "credit_limit", precision: 12, scale: 2, nullable: true, transformer: { to: (v: any) => v, from: (v: any) => (v === null || v === undefined ? null : Number(v)) } })
    creditlimit: number | null;

    @Column("boolean", { name: "blocked", default: false })
    blocked: boolean;

    @Column("character varying", { name: "block_reason", length: 200, nullable: true })
    blockreason: string | null;

    @Column("timestamp with time zone", { name: "blocked_on", nullable: true })
    blockedon: Date | null;

    @Column("integer", { name: "blocked_by", nullable: true })
    blockedby: number | null;

    @Column("numeric", { name: "discount_pcnt", precision: 5, scale: 2, nullable: true, transformer: { to: (v: any) => v, from: (v: any) => (v === null || v === undefined ? null : Number(v)) } })
    discountpcnt: number | null;

    @OneToMany(() => PurchaseInvoice, (purchaseInvoice) => purchaseInvoice.vendor)
    purchaseInvoices: PurchaseInvoice[];

    @OneToMany(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.vendor)
    purchaseOrders: PurchaseOrder[];

    @OneToMany(() => PurchaseRequest, (purchaseRequest) => purchaseRequest.vendor)
    purchaseRequests: PurchaseRequest[];

    @OneToMany(() => VendorPayment, (vendorPayment) => vendorPayment.vendor)
    payments: VendorPayment[];

}
