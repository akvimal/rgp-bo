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

@Entity("sale_return_item")
export class SaleReturnItem extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;
  @Column("integer", { name: "sale_item_id"})
  saleitemid: number;

  @Column("integer", { name: "qty" })
  qty: number;
  
  @Column("character varying", { name: "status", nullable: true })
  status: string | null;

  @Column("character varying", { name: "reason", nullable: true })
  reason: string | null;

  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  @ManyToOne(
    () => SaleItem,
    (saleitem) => saleitem.returns, { onDelete: 'CASCADE' }
  )
  @JoinColumn([{ name: "sale_item_id", referencedColumnName: "id" }])
  saleitem: SaleItem;

}
