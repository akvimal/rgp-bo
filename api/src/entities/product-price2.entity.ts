import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Product } from "./product.entity";

@Index("product_price2_pk", ["id"], { unique: true })
@Index("product_price2_un", ["productid", "effdate"], { unique: true })
@Entity("product_price2")
export class ProductPrice2 extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "product_id", unique: true })
  productid: number;

  @Column("double precision", { name: "sale_price", precision: 53 })
  saleprice: number;

  @Column({ name: 'eff_date', type: 'date', default: () => 'CURRENT_DATE', unique: true })
  effdate: Date;

  @Column("character varying", { name: "reason" })
  reason: string;

  @Column("character varying", { name: "comments" })
  comments: string;

  @ManyToOne(
    () => Product,
    (product) => product.prices
  )
  @JoinColumn([{ name: "product_id", referencedColumnName: "id" }])
  product: Product;
}
