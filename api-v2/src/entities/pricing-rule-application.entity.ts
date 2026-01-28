import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { PricingRule } from "./pricing-rule.entity";
import { Product } from "./product.entity";
import { Sale } from "./sale.entity";
import { SaleItem } from "./sale-item.entity";
import { AppUser } from "./appuser.entity";

@Index("pricing_rule_application_pk", ["id"], { unique: true })
@Index("idx_pricing_rule_app_rule", ["pricingRuleId", "appliedOn"])
@Index("idx_pricing_rule_app_product", ["productId", "appliedOn"])
@Index("idx_pricing_rule_app_sale", ["saleId"])
@Index("idx_pricing_rule_app_date", ["appliedOn"])
@Entity("pricing_rule_application")
export class PricingRuleApplication extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("integer", { name: "pricing_rule_id", nullable: true })
  pricingRuleId: number | null;

  @Column("integer", { name: "product_id" })
  productId: number;

  @Column("integer", { name: "sale_id", nullable: true })
  saleId: number | null;

  @Column("integer", { name: "sale_item_id", nullable: true })
  saleItemId: number | null;

  @Column("numeric", { name: "original_price", precision: 10, scale: 2, nullable: true })
  originalPrice: number | null;

  @Column("numeric", { name: "calculated_price", precision: 10, scale: 2 })
  calculatedPrice: number;

  @Column("numeric", { name: "discount_amount", precision: 10, scale: 2, nullable: true })
  discountAmount: number | null;

  @Column("numeric", { name: "margin_pcnt", precision: 5, scale: 2, nullable: true })
  marginPcnt: number | null;

  @Column("integer", { name: "quantity", default: 1 })
  quantity: number;

  @Column("timestamp with time zone", { name: "applied_on", default: () => "CURRENT_TIMESTAMP" })
  appliedOn: Date;

  @Column("integer", { name: "applied_by", nullable: true })
  appliedBy: number | null;

  @ManyToOne(() => PricingRule)
  @JoinColumn([{ name: "pricing_rule_id", referencedColumnName: "id" }])
  pricingRule: PricingRule | null;

  @ManyToOne(() => Product)
  @JoinColumn([{ name: "product_id", referencedColumnName: "id" }])
  product: Product;

  @ManyToOne(() => Sale)
  @JoinColumn([{ name: "sale_id", referencedColumnName: "id" }])
  sale: Sale | null;

  @ManyToOne(() => SaleItem)
  @JoinColumn([{ name: "sale_item_id", referencedColumnName: "id" }])
  saleItem: SaleItem | null;

  @ManyToOne(() => AppUser)
  @JoinColumn([{ name: "applied_by", referencedColumnName: "id" }])
  appliedByUser: AppUser | null;
}
