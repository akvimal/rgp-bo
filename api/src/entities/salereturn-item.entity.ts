import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { SaleItem } from "./sale-item.entity";

@Index("sale_return_item_pk", ["id"], { unique: true })
@Entity("sale_return_item")
export class SaleReturnItem extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "sale_item_id"})
  saleitemid: number;

  @Column("integer", { name: "qty" })
  returnqty: number;
  
  @Column("double precision", { name: "return_amount", precision: 53 })
  returnamount: number;

  @Column("character varying", { name: "return_paymode", nullable: true })
  returnpaymode: string | null;

  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "reason", nullable: true })
  reason: string | null;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  @ManyToOne(
    () => SaleItem,
    (saleitem) => saleitem.returns
  )
  @JoinColumn([{ name: "sale_item_id", referencedColumnName: "id" }])
  saleitem: SaleItem;

}
