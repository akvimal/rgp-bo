import {
    Column,
    Entity,
    Index, OneToMany,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { Store } from "./store.entity";
  
  @Index("business_pk", ["id"], { unique: true })
  @Index("business_un", ["name"], { unique: true })
  @Entity("business")

  export class Business {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "name", unique: true, length: 40 })
    name: string;

    @Column({ name: "active", type: "boolean", default: true })
    isActive: boolean;

    @Column({ name: "archive", type: "boolean", default: false })
    isArchived: boolean;
    
    @OneToMany(
      () => Store,
      (loc) => loc.business
    )
    stores: Store[];
}
