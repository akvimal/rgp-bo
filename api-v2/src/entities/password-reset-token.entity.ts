import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AppUser } from "./appuser.entity";

@Index("password_reset_token_unique", ["token"], { unique: true })
@Index("idx_password_reset_token_token", ["token", "used"])
@Index("idx_password_reset_token_expires", ["expiresAt", "used"])
@Entity("password_reset_token")
export class PasswordResetToken {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "user_id" })
  userId: number;

  @Column("character varying", { name: "token", length: 255 })
  token: string;

  @Column({ name: "expires_at", type: "timestamp with time zone" })
  expiresAt: Date;

  @Column({ name: "used", type: "boolean", default: false })
  used: boolean;

  @Column({ name: "used_at", type: "timestamp with time zone", nullable: true })
  usedAt: Date | null;

  @Column("character varying", { name: "ip_address", nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ name: "created_on", type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  createdOn: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: AppUser;
}
