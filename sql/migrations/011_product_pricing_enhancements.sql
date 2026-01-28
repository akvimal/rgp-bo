-- Migration 011: Product Pricing Enhancements
-- Created: 2026-01-17
-- Purpose: Add margin and discount calculation fields to product_price2
-- Issue: #122 - Auto-calculate price margins

-- Add pricing calculation columns to product_price2
ALTER TABLE product_price2
ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS margin_pcnt NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS discount_pcnt NUMERIC(5,2);

-- Add comments for documentation
COMMENT ON COLUMN product_price2.base_price IS 'Base purchase price (PTR - Purchase to Retailer)';
COMMENT ON COLUMN product_price2.mrp IS 'Maximum Retail Price';
COMMENT ON COLUMN product_price2.margin_pcnt IS 'Profit margin percentage = ((sale_price - base_price) / base_price) * 100';
COMMENT ON COLUMN product_price2.discount_pcnt IS 'Discount percentage = ((mrp - sale_price) / mrp) * 100';

-- Add validation constraints
ALTER TABLE product_price2
ADD CONSTRAINT check_price_not_below_base
  CHECK (base_price IS NULL OR sale_price >= base_price),
ADD CONSTRAINT check_price_not_above_mrp
  CHECK (mrp IS NULL OR sale_price <= mrp),
ADD CONSTRAINT check_margin_pcnt_valid
  CHECK (margin_pcnt IS NULL OR margin_pcnt >= -100),
ADD CONSTRAINT check_discount_pcnt_valid
  CHECK (discount_pcnt IS NULL OR (discount_pcnt >= 0 AND discount_pcnt <= 100));

-- Backfill margin and discount for existing records from purchase_invoice_item
-- This is a best-effort backfill based on most recent purchase
UPDATE product_price2 pp2
SET
  base_price = COALESCE(pii.ptr_value, pii.ptr_cost),
  mrp = pii.mrp_cost,
  margin_pcnt = CASE
    WHEN pii.ptr_value > 0 THEN
      ROUND((((pp2.sale_price - pii.ptr_value) / pii.ptr_value) * 100)::numeric, 2)
    ELSE NULL
  END,
  discount_pcnt = CASE
    WHEN pii.mrp_cost > 0 THEN
      ROUND((((pii.mrp_cost - pp2.sale_price) / pii.mrp_cost) * 100)::numeric, 2)
    ELSE NULL
  END
FROM (
  SELECT DISTINCT ON (pii.product_id)
    pii.product_id,
    pii.ptr_value,
    pii.ptr_cost,
    pii.mrp_cost,
    pii.sale_price,
    pii.created_on
  FROM purchase_invoice_item pii
  WHERE pii.active = true
  ORDER BY pii.product_id, pii.created_on DESC
) pii
WHERE pp2.product_id = pii.product_id
  AND pp2.base_price IS NULL;  -- Only update records that don't have base_price yet

