import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";

export enum PricingRuleType {
  CATEGORY_MARGIN = 'CATEGORY_MARGIN',
  CATEGORY_DISCOUNT = 'CATEGORY_DISCOUNT',
  PRODUCT_PROMOTION = 'PRODUCT_PROMOTION',
  QUANTITY_DISCOUNT = 'QUANTITY_DISCOUNT',
  TIME_BASED = 'TIME_BASED',
  CLEARANCE = 'CLEARANCE',
  SEASONAL = 'SEASONAL',
}

export enum PricingRuleStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

@Index("pricing_rule_pkey", ["id"], { unique: true })
@Index("pricing_rule_rule_code_key", ["rulecode"], { unique: true })
@Entity("pricing_rule")
export class PricingRule extends BaseEntity {

  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  // Rule identification
  @Column("character varying", { name: "rule_code", length: 50, unique: true })
  rulecode: string;

  @Column("character varying", { name: "rule_name", length: 200 })
  rulename: string;

  @Column("enum", { name: "rule_type", enum: PricingRuleType })
  ruletype: PricingRuleType;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  // Rule scope
  @Column("character varying", { name: "applies_to", length: 20, default: 'CATEGORY' })
  appliesto: string; // CATEGORY, PRODUCT, ALL

  @Column("character varying", { name: "category", length: 50, nullable: true })
  category: string | null;

  @Column("integer", { name: "product_id", nullable: true })
  productid: number | null;

  // Pricing parameters
  @Column("character varying", { name: "calculation_method", length: 50 })
  calculationmethod: string; // MARGIN_ON_PTR, DISCOUNT_FROM_MRP, FIXED_PRICE

  @Column("numeric", { name: "margin_pcnt", precision: 5, scale: 2, nullable: true })
  marginpcnt: number | null;

  @Column("numeric", { name: "discount_pcnt", precision: 5, scale: 2, nullable: true })
  discountpcnt: number | null;

  @Column("numeric", { name: "fixed_price", precision: 10, scale: 2, nullable: true })
  fixedprice: number | null;

  @Column("integer", { name: "min_quantity", default: 1 })
  minquantity: number;

  @Column("integer", { name: "max_quantity", nullable: true })
  maxquantity: number | null;

  // Time validity
  @Column("date", { name: "valid_from", default: () => "CURRENT_DATE" })
  validfrom: Date;

  @Column("date", { name: "valid_to", default: () => "'2099-12-31'" })
  validto: Date;

  // Priority and stacking
  @Column("integer", { name: "priority", default: 10 })
  priority: number;

  @Column("boolean", { name: "stackable", default: false })
  stackable: boolean;

  // Status
  @Column("enum", { name: "status", enum: PricingRuleStatus, default: PricingRuleStatus.DRAFT })
  status: PricingRuleStatus;
}
