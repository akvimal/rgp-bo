import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("product_price_pk", ["id"], { unique: true })
@Index("product_price_un", ["itemid"], { unique: true })
@Entity("product_price")
export class ProductPrice extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "item_id", unique: true })
  itemid: number;

  @Column("double precision", { name: "price", precision: 53 })
  price: number;

  @Column({ name: 'eff_date', type: 'date', default: () => 'CURRENT_DATE' })
  effdate: Date;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

}
