import {
    Column,
    Entity,
    Index,
    PrimaryGeneratedColumn,
  } from "typeorm";
import { BaseEntity } from "./base.entity";
  
  @Index("document_pk", ["id"], { unique: true })
  @Entity("documents")

  export class Document extends BaseEntity {
  
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;
  
    @Column("character varying", { name: "doc_name" })
    name: string;    

    @Column("character varying", { name: "doc_path" })
    path: string;    
    @Column("character varying", { name: "doc_extn" })
    extn: string;
    
    @Column("character varying", { name: "alias" })
    alias: string;
    @Column("character varying", { name: "category" })
    category: string;

    @Column("json", { name: "doc_props", nullable: true })
    docprops: object | null;
    @Column("json", { name: "upload_props", nullable: true })
    uploadprops: object | null;
}