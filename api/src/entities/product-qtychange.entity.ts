import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("product_qtychange_pk", ["id"], { unique: true })
@Entity("product_qtychange")
export class ProductQtyChange extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "item_id"})
  itemid: number;

  @Column("integer", { name: "qty"})
  qty: number;

  @Column("double precision", { name: "sale_price", precision: 53 })
  price: number;

  @Column("character varying", { name: "reason", nullable: true })
  reason: string | null;
  
  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

}
