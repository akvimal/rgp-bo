import {
    Column,
    Entity,
    Index,
    PrimaryGeneratedColumn,
  } from "typeorm";
  
  @Index("document_pk", ["id"], { unique: true })
  @Entity("documents")

  export class Document {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "doc_name" })
    name: string;    
    @Column("character varying", { name: "doc_alias" })
    alias: string;
    @Column("character varying", { name: "doc_path" })
    path: string;    
    @Column("character varying", { name: "doc_extn" })
    extn: string;
    
}