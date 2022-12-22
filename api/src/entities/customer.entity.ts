import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Sale } from "./sale.entity";

@Index("customer_pk", ["id"], { unique: true })
@Index("customer_un", ["mobile", "name"], { unique: true })
@Entity("customer")
export class Customer extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "name", nullable: true, unique: true })
  name: string | null;

  @Column("character varying", { name: "mobile", nullable: true, unique: true })
  mobile: string | null;

  @Column("character varying", { name: "email", nullable: true, unique: true })
  email: string | null;

  @Column("character varying", { name: "locality", nullable: true })
  locality: string | null;
  @Column("character varying", { name: "address", nullable: true })
  address: string | null;
  @Column("character varying", { name: "area", nullable: true })
  area: string | null;
  
  @Column("character varying", { name: "source_type", nullable: true })
  srctype: string | null;
  @Column("character varying", { name: "source_desc", nullable: true })
  srcdesc: string | null;

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];
}
