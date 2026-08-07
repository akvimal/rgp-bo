import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { BaseEntity } from "./base.entity";

@Index("delivery_partner_pk", ["id"], { unique: true })
@Index("delivery_partner_un", ["name"], { unique: true })
@Entity("delivery_partner")
export class DeliveryPartner extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "name", length: 80 })
  name: string;

  @Column("character varying", { name: "contact_name", nullable: true, length: 80 })
  contactname: string | null;

  @Column("character varying", { name: "contact_phone", nullable: true, length: 40 })
  contactphone: string | null;

  @Column("character varying", { name: "address", nullable: true, length: 200 })
  address: string | null;

  @Column("character varying", { name: "comments", nullable: true, length: 400 })
  comments: string | null;
}
