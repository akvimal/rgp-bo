import {
    Column,
    Entity,
    Index, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { BaseEntity } from "./base.entity";
import { ProductPrice2 } from "./product-price2.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { PurchaseRequest } from "./purchase-request.entity";
  
  @Index("product_pk", ["id"], { unique: true })
  @Index("product_un", ["title"], { unique: true })
  @Entity("product")

  export class Product extends BaseEntity {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "title", unique: true, length: 40 })
    title: string;
    
    @Column("character varying", { name: "product_code", length: 40 })
    code: string;
    @Column("double precision", { name: "pack" })
    pack: number;
    
    @Column("character varying", { name: "hsn_code", length: 40 })
    hsn: string;    
    @Column("character varying", { name: "mfr", length: 40 })
    mfr: string;    
    @Column("character varying", { name: "brand", length: 40 })
    brand: string;
    @Column("character varying", { name: "category", length: 40 })
    category: string;

    @Column("character varying", { name: "description", length: 400 })
    description: string;

    @Column("json", { name: "more_props", nullable: true })
    props: object | null;


    @OneToMany(
      () => ProductPrice2,
      (price) => price.product
    )
    prices: ProductPrice2[];

    @OneToMany(
      () => PurchaseRequest,
      (request) => request.product
    )
    requests: PurchaseRequest[];

    @OneToMany(
      () => PurchaseInvoiceItem,
      (purchaseInvoiceItem) => purchaseInvoiceItem.product
    )
    purchaseInvoiceItems: PurchaseInvoiceItem[];
  
}