import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { CustomerCreditAccount } from "./customer-credit-account.entity";
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

  @Column("character varying", { name: "alt_mobile", length: 10, nullable: true })
  altmobile: string | null;

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

  /** YES / NO, or null when never asked: promotional messages go only to YES */
  @Column("text", { name: "contact_consent", nullable: true })
  consent: string | null;
  @Column("timestamptz", { name: "consent_on", nullable: true })
  consentOn: Date | null;
  @Column("integer", { name: "consent_by", nullable: true })
  consentBy: number | null;
  @Column("boolean", { name: "do_not_contact", default: false })
  doNotContact: boolean;
  @Column("text", { name: "preferred_channel", nullable: true })
  preferredChannel: string | null;
  /** en or ta: the language of the WhatsApp templates this customer is sent (null = English) */
  @Column("character varying", { name: "message_language", length: 2, nullable: true })
  messageLanguage: string | null;
  /** asked not to be invited to review the store (does not stop other messages) */
  @Column("boolean", { name: "review_optout", default: false })
  reviewOptOut: boolean;

  /** the household (the account behind one mobile number) this person belongs to; set by a database trigger for every writer (migration 193) */
  @Column("integer", { name: "household_id", nullable: true })
  householdid: number | null;

  /** optional: SELF, SPOUSE, CHILD, PARENT or OTHER */
  @Column("character varying", { name: "relationship", length: 10, nullable: true })
  relationship: string | null;

  @Column("date", { name: "dob", nullable: true })
  dob: string | null;

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];

  @OneToMany(
    () => CustomerCreditAccount,
    (acc) => acc.customer
  )
  credits: CustomerCreditAccount[];
}
