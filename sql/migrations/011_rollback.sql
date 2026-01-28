-- Rollback Migration 011: Product Pricing Enhancements
-- Created: 2026-01-17
-- Purpose: Remove pricing enhancement columns from product_price2

-- Drop constraints first
ALTER TABLE product_price2
DROP CONSTRAINT IF EXISTS check_price_not_below_base,
DROP CONSTRAINT IF EXISTS check_price_not_above_mrp,
DROP CONSTRAINT IF EXISTS check_margin_pcnt_valid,
DROP CONSTRAINT IF EXISTS check_discount_pcnt_valid;

-- Drop columns
ALTER TABLE product_price2
DROP COLUMN IF EXISTS base_price,
DROP COLUMN IF EXISTS mrp,
DROP COLUMN IF EXISTS margin_pcnt,
DROP COLUMN IF EXISTS discount_pcnt;

