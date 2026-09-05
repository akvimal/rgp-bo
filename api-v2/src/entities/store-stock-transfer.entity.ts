import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Store } from "./store.entity";
import { PurchaseInvoiceItem } from "./purchase-invoice-item.entity";
import { AppUser } from "./appuser.entity";

@Index("store_stock_transfer_pk", ["id"], { unique: true })
@Entity("store_stock_transfer")
export class StoreStockTransfer extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "from_store_id" })
  fromstoreid: number;

  @Column("integer", { name: "to_store_id" })
  tostoreid: number;

  @Column("integer", { name: "purchase_item_id" })
  purchaseitemid: number;

  @Column("integer", { name: "qty" })
  qty: number;

  @Column("integer", { name: "received_qty", nullable: true })
  receivedqty: number | null;

  @Column("character varying", { name: "status", length: 20, default: "IN_TRANSIT" })
  status: string;

  @Column("character varying", { name: "notes", length: 200, nullable: true })
  notes: string | null;

  @Column("integer", { name: "requested_by", nullable: true })
  requestedby: number | null;

  @Column("integer", { name: "received_by", nullable: true })
  receivedby: number | null;

  @Column("timestamp with time zone", { name: "dispatched_on", nullable: true })
  dispatchedon: Date | null;

  @Column("timestamp with time zone", { name: "received_on", nullable: true })
  receivedon: Date | null;

  @ManyToOne(() => Store)
  @JoinColumn([{ name: "from_store_id", referencedColumnName: "id" }])
  fromstore: Store;

  @ManyToOne(() => Store)
  @JoinColumn([{ name: "to_store_id", referencedColumnName: "id" }])
  tostore: Store;

  @ManyToOne(() => PurchaseInvoiceItem)
  @JoinColumn([{ name: "purchase_item_id", referencedColumnName: "id" }])
  purchaseitem: PurchaseInvoiceItem;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn([{ name: "requested_by", referencedColumnName: "id" }])
  requesteduser: AppUser | null;

  @ManyToOne(() => AppUser, { nullable: true })
  @JoinColumn([{ name: "received_by", referencedColumnName: "id" }])
  receiveduser: AppUser | null;
}
