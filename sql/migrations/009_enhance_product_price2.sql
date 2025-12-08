-- Migration 009: Enhance product_price2 with pricing components
-- Purpose: Add detailed pricing components for better price management
-- Author: System
-- Date: 2025-12-05

-- Add new columns to product_price2
ALTER TABLE product_price2
    ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS margin_pcnt NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS discount_pcnt NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS tax_pcnt NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS pricing_rule_id INTEGER,
    ADD COLUMN IF NOT EXISTS calculation_method VARCHAR(50) DEFAULT 'STANDARD';

-- Add comments
COMMENT ON COLUMN product_price2.mrp IS 'Maximum Retail Price';
COMMENT ON COLUMN product_price2.base_price IS 'Base cost (PTR + Tax if applicable)';
COMMENT ON COLUMN product_price2.margin_pcnt IS 'Profit margin percentage on base price';
COMMENT ON COLUMN product_price2.discount_pcnt IS 'Discount percentage from MRP';
COMMENT ON COLUMN product_price2.tax_pcnt IS 'Tax percentage (copied from product for history)';
COMMENT ON COLUMN product_price2.tax_inclusive IS 'Whether sale_price includes tax';
COMMENT ON COLUMN product_price2.calculation_method IS 'Pricing calculation method: STANDARD, PROMOTIONAL, CLEARANCE, MARGIN_ON_PTR, DISCOUNT_FROM_MRP';
COMMENT ON COLUMN product_price2.pricing_rule_id IS 'Reference to pricing rule if applicable';

-- Add constraints
ALTER TABLE product_price2
    ADD CONSTRAINT product_price2_mrp_positive CHECK (mrp IS NULL OR mrp > 0),
    ADD CONSTRAINT product_price2_sale_price_valid CHECK (sale_price IS NULL OR (mrp IS NULL OR sale_price <= mrp)),
    ADD CONSTRAINT product_price2_margin_valid CHECK (margin_pcnt IS NULL OR (margin_pcnt >= -100 AND margin_pcnt <= 1000)),
    ADD CONSTRAINT product_price2_discount_valid CHECK (discount_pcnt IS NULL OR (discount_pcnt >= 0 AND discount_pcnt <= 100));

-- Create view for current prices with all components and calculations
CREATE OR REPLACE VIEW product_current_price_view AS
SELECT
    pp.id as price_id,
    pp.product_id,
    p.title as product_name,
    p.product_code,
    p.hsn_code,
    p.category,
    p.pack,

    -- Price components
    pp.mrp,
    pp.base_price,
    pp.margin_pcnt,
    pp.discount_pcnt,
    pp.tax_pcnt,
    pp.sale_price,
    pp.tax_inclusive,
    pp.calculation_method,

    -- Dates
    pp.eff_date,
    pp.end_date,
    pp.reason,
    pp.comments,

    -- Calculated fields
    CASE
        WHEN pp.tax_inclusive THEN pp.sale_price::numeric
        ELSE ROUND((pp.sale_price * (1 + COALESCE(pp.tax_pcnt, 0)/100))::numeric, 2)
    END as sale_price_with_tax,

    CASE
        WHEN pp.mrp IS NOT NULL AND pp.sale_price IS NOT NULL
        THEN (pp.mrp - pp.sale_price)::numeric
        ELSE NULL
    END as savings_amount,

    CASE
        WHEN pp.mrp IS NOT NULL AND pp.sale_price IS NOT NULL AND pp.mrp > 0
        THEN ROUND((((pp.mrp - pp.sale_price) / pp.mrp * 100))::numeric, 2)
        ELSE NULL
    END as savings_pcnt,

    CASE
        WHEN pp.base_price IS NOT NULL AND pp.sale_price IS NOT NULL AND pp.base_price > 0
        THEN ROUND((((pp.sale_price - pp.base_price) / pp.base_price * 100))::numeric, 2)
        ELSE pp.margin_pcnt
    END as calculated_margin_pcnt,

    -- Audit
    pp.created_on,
    pp.updated_on,
    pp.active

FROM product_price2 pp
INNER JOIN product p ON p.id = pp.product_id
WHERE pp.active = true
    AND CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date;

COMMENT ON VIEW product_current_price_view IS 'Current prices for all products with all components and calculations';

-- Create view for price history
CREATE OR REPLACE VIEW product_price_history_view AS
SELECT
    pp.id as price_id,
    pp.product_id,
    p.title as product_name,
    p.hsn_code,
    pp.sale_price,
    pp.mrp,
    pp.margin_pcnt,
    pp.discount_pcnt,
    pp.tax_pcnt,
    pp.eff_date,
    pp.end_date,
    pp.reason,
    pp.calculation_method,

    -- Duration
    pp.end_date - pp.eff_date as days_active,

    -- Price change calculation (compared to previous)
    LAG(pp.sale_price) OVER (PARTITION BY pp.product_id ORDER BY pp.eff_date) as previous_price,
    (pp.sale_price - LAG(pp.sale_price) OVER (PARTITION BY pp.product_id ORDER BY pp.eff_date))::numeric as price_change,
    CASE
        WHEN LAG(pp.sale_price) OVER (PARTITION BY pp.product_id ORDER BY pp.eff_date) > 0
        THEN ROUND((((pp.sale_price - LAG(pp.sale_price) OVER (PARTITION BY pp.product_id ORDER BY pp.eff_date)) /
                    LAG(pp.sale_price) OVER (PARTITION BY pp.product_id ORDER BY pp.eff_date) * 100))::numeric, 2)
        ELSE NULL
    END as price_change_pcnt,

    pp.created_on,
    pp.created_by

FROM product_price2 pp
INNER JOIN product p ON p.id = pp.product_id
WHERE pp.active = true
ORDER BY pp.product_id, pp.eff_date DESC;

COMMENT ON VIEW product_price_history_view IS 'Complete price history with change analysis';

-- Backfill tax_pcnt from product table for existing prices
UPDATE product_price2 pp
SET tax_pcnt = p.tax_pcnt
FROM product p
WHERE pp.product_id = p.id
    AND pp.tax_pcnt IS NULL
    AND p.tax_pcnt IS NOT NULL;

-- Summary report
SELECT
    'Current active prices' as metric,
    COUNT(*) as count,
    ROUND(AVG(sale_price)::numeric, 2) as avg_sale_price,
    ROUND(AVG(mrp)::numeric, 2) as avg_mrp,
    ROUND(AVG(margin_pcnt)::numeric, 2) as avg_margin_pcnt
FROM product_current_price_view;
