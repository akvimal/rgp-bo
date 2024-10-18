import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { Business } from "./business.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { VendorPayment } from "./vendor-payment.entity";
  import { Vendor } from "./vendor.entity";
  
  @Index("busloc_pk", ["id"], { unique: true })
  @Index("busloc_un", ["businessid", "name"], { unique: true })
  @Entity("business_location")
  export class BusinessLocation {

    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "name", unique: true })
    name: string;
    
    @Column("json", { name: "config", nullable: true })
    config: object | null;

    @Column("integer", { name: "business_id", unique: true })
    businessid: number;
    
    @ManyToOne(() => Business, (business) => business.locations)
    @JoinColumn([{ name: "business_id", referencedColumnName: "id" }])
    business: Business;
  
  }
  