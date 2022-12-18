import {
    Column,
    Entity,
    Index, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { BaseEntity } from "./base.entity";
import { PurchaseInvoice } from "./purchase-invoice.entity";
  
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

    @OneToMany(() => PurchaseInvoice, (purchaseInvoice) => purchaseInvoice.vendor)
    purchaseInvoices: PurchaseInvoice[];
}