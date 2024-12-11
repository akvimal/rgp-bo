import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Sale } from "./sale.entity";

@Index("sale_deliveries_pk", ["id"], { unique: true })
@Entity("sale_deliveries")
export class SaleDelivery extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "saleId", unique: true })
  saleId: number;

  @Column("integer", { name: "booked_by", unique: true })
  bookedby: number;
  @Column("date", { name: "booked_date", nullable: true })
  bookeddate: string | null;

  @Column("character varying", { name: "receiver_name", nullable: true })
  receivername: string | null;
  @Column("character varying", { name: "receiver_phone", nullable: true })
  receiverphone: string | null;
  @Column("character varying", { name: "receiver_address", nullable: true })
  receiveraddress: string | null;
  
  @Column("date", { name: "delivery_date", nullable: true })
  deliverydate: string | null;
  @Column("character varying", { name: "delivery_by", nullable: true })
  deliveryby: string | null;
  
  @Column("double precision", { name: "charges", precision: 53 })
  charges: number;
  
  @Column("character varying", { name: "status", nullable: true })
  status: string | null;
  @Column("character varying", { name: "comments", nullable: true })
  comments: string | null;

  // @ManyToOne(() => Sale, (sale) => sale.deliveries, { onDelete: 'CASCADE' })
  // @JoinColumn([{ name: "sale_id", referencedColumnName: "id" }])
  // sale: Sale;

    
    @OneToOne(() => Sale, (sale) => sale.delivery)
    @JoinColumn()
    sale: Sale;
}
