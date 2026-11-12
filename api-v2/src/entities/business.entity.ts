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

    /** the business's own logo for the page header: a small image data URL, or empty for the default */
    @Column("text", { name: "logo", nullable: true })
    logo: string | null;

    @Column("character varying", { name: "approval_mode", length: 10, default: "separate" })
    approvalmode: string;

    @Column("character varying", { name: "business_type", length: 20, default: "pharmacy" })
    businesstype: string;

    @Column("character varying", { name: "legal_form", length: 20, default: "PROPRIETORSHIP" })
    legalform: string;

    @Column("character varying", { name: "staffing_preset", length: 20, nullable: true })
    staffingpreset: string | null;

    @Column({ name: "active", type: "boolean", default: true })
    isActive: boolean;

    @Column({ name: "archive", type: "boolean", default: false })
    isArchived: boolean;

    @Column("character varying", { name: "gstin", length: 15, nullable: true })
    gstin: string | null;

    @Column("character varying", { name: "legal_name", nullable: true })
    legalname: string | null;

    /** the business's phone number(s), shown on the bill when the store has none of its own */
    @Column("character varying", { name: "phone", length: 60, nullable: true })
    phone: string | null;

    /** the website printed at the end of the bill */
    @Column("character varying", { name: "website", length: 120, nullable: true })
    website: string | null;

    /** a separate phone number for grievances, printed at the end of the bill */
    @Column("character varying", { name: "grievance_phone", length: 60, nullable: true })
    grievancephone: string | null;

    /** what the bill prints: the MRP column (off by default) and the "You saved" box (on) */
    @Column("boolean", { name: "bill_show_mrp", default: false })
    showmrp: boolean;

    @Column("boolean", { name: "bill_show_saving", default: true })
    showsaving: boolean;

    /** the "Please keep this bill for any return or exchange" line on the bill (on) */
    @Column("boolean", { name: "bill_show_return_note", default: true })
    showreturnnote: boolean;

    /** the "Change password" link on the sign-in page (on) */
    @Column("boolean", { name: "login_show_change_password", default: true })
    showchangepasswordlink: boolean;

    /** the words of that line; empty means the standard wording */
    @Column("character varying", { name: "bill_return_note", length: 300, nullable: true })
    returnnote: string | null;

    @Column("character varying", { name: "state_code", length: 2, nullable: true })
    statecode: string | null;

    @Column("character varying", { name: "address", nullable: true })
    address: string | null;

    @Column("character varying", { name: "pincode", length: 10, nullable: true })
    pincode: string | null;

    @OneToMany(
      () => Store,
      (loc) => loc.business
    )
    stores: Store[];
}
