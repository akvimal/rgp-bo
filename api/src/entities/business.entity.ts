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
  
    @Column("character varying", { name: "business_name", unique: true, length: 40 })
    name: string;
    
    @OneToMany(
      () => Store,
      (loc) => loc.business
    )
    stores: Store[];
}