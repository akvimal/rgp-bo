import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";
import { Store } from "./store.entity";

@Index("user_store_pk", ["id"], { unique: true })
@Entity("user_stores")
export class UserStore {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "user_id" })
  userid: number;

  @Column("integer", { name: "store_id" })
  storeid: number;

  @Column({ name: "is_primary", type: "boolean", default: false })
  isprimary: boolean;

  @ManyToOne(() => AppUser, { nullable: false })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;

  @ManyToOne(() => Store, { nullable: false })
  @JoinColumn([{ name: "store_id", referencedColumnName: "id" }])
  store: Store;
}
