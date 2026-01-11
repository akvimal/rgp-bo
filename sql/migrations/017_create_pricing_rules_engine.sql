-- Migration 010: Create Pricing Rules Engine
-- Purpose: Enable promotional pricing, category-based rules, and time-based discounts
-- Author: System
-- Date: 2025-12-05

-- Create pricing rule types enum
CREATE TYPE pricing_rule_type AS ENUM (
    'CATEGORY_MARGIN',      -- Apply margin to entire category
    'CATEGORY_DISCOUNT',    -- Apply discount to entire category
    'PRODUCT_PROMOTION',    -- Promotional price for specific products
    'QUANTITY_DISCOUNT',    -- Bulk purchase discounts
    'TIME_BASED',          -- Time-limited offers
    'CLEARANCE',           -- Expiry-based clearance pricing
    'SEASONAL'             -- Seasonal pricing adjustments
);

-- Create pricing rule status enum
CREATE TYPE pricing_rule_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'EXPIRED',
    'ARCHIVED'
);

-- Create pricing rules table
CREATE TABLE IF NOT EXISTS public.pricing_rule (
    id SERIAL PRIMARY KEY,

    -- Rule identification
    rule_code VARCHAR(50) UNIQUE NOT NULL,
    rule_name VARCHAR(200) NOT NULL,
    rule_type pricing_rule_type NOT NULL,
    description TEXT,

    -- Rule scope
    applies_to VARCHAR(20) NOT NULL DEFAULT 'CATEGORY', -- CATEGORY, PRODUCT, ALL
    category VARCHAR(50),                               -- Product category if applicable
    product_id INTEGER,                                 -- Specific product if applicable

    -- Pricing parameters
    calculation_method VARCHAR(50) NOT NULL,            -- MARGIN_ON_PTR, DISCOUNT_FROM_MRP, FIXED_PRICE
    margin_pcnt NUMERIC(5,2),                          -- Margin percentage
    discount_pcnt NUMERIC(5,2),                        -- Discount percentage
    fixed_price NUMERIC(10,2),                         -- Fixed price amount
    min_quantity INTEGER DEFAULT 1,                    -- Minimum quantity for rule to apply
    max_quantity INTEGER,                              -- Maximum quantity (NULL = unlimited)

    -- Time validity
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE DEFAULT '2099-12-31',

    -- Priority and stacking
    priority INTEGER DEFAULT 10,                       -- Higher priority rules apply first
    stackable BOOLEAN DEFAULT false,                   -- Can combine with other rules

    -- Status and audit
    status pricing_rule_status DEFAULT 'DRAFT',
    active BOOLEAN DEFAULT true NOT NULL,
    archive BOOLEAN DEFAULT false NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INTEGER,
    updated_by INTEGER,

    -- Constraints
    CONSTRAINT pricing_rule_category_or_product CHECK (
        (applies_to = 'CATEGORY' AND category IS NOT NULL) OR
        (applies_to = 'PRODUCT' AND product_id IS NOT NULL) OR
        (applies_to = 'ALL')
    ),
    CONSTRAINT pricing_rule_valid_dates CHECK (valid_from <= valid_to),
    CONSTRAINT pricing_rule_margin_valid CHECK (margin_pcnt IS NULL OR (margin_pcnt >= -100 AND margin_pcnt <= 1000)),
    CONSTRAINT pricing_rule_discount_valid CHECK (discount_pcnt IS NULL OR (discount_pcnt >= 0 AND discount_pcnt <= 100)),
    CONSTRAINT pricing_rule_price_positive CHECK (fixed_price IS NULL OR fixed_price > 0),
    CONSTRAINT pricing_rule_quantity_valid CHECK (min_quantity >= 1 AND (max_quantity IS NULL OR max_quantity >= min_quantity))
);

-- Create indexes
CREATE INDEX idx_pricing_rule_active ON pricing_rule(status, valid_from, valid_to)
    WHERE active = true AND archive = false;

CREATE INDEX idx_pricing_rule_category ON pricing_rule(category, status)
    WHERE active = true;

CREATE INDEX idx_pricing_rule_product ON pricing_rule(product_id, status)
    WHERE active = true;

CREATE INDEX idx_pricing_rule_dates ON pricing_rule(valid_from, valid_to, priority DESC)
    WHERE active = true AND status = 'ACTIVE';

-- Create pricing rule application log
CREATE TABLE IF NOT EXISTS public.pricing_rule_application (
    id SERIAL PRIMARY KEY,

    -- Reference
    pricing_rule_id INTEGER NOT NULL REFERENCES pricing_rule(id),
    product_id INTEGER NOT NULL,
    price_id INTEGER,                                  -- Reference to product_price2 if applicable

    -- Applied pricing
    original_price NUMERIC(10,2) NOT NULL,
    calculated_price NUMERIC(10,2) NOT NULL,
    discount_amount NUMERIC(10,2),
    margin_pcnt NUMERIC(5,2),

    -- Context
    quantity INTEGER DEFAULT 1,
    applied_on DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Audit
    active BOOLEAN DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INTEGER
);

CREATE INDEX idx_pricing_rule_app_product ON pricing_rule_application(product_id, applied_on);
CREATE INDEX idx_pricing_rule_app_rule ON pricing_rule_application(pricing_rule_id, applied_on);

-- Comments
COMMENT ON TABLE pricing_rule IS 'Pricing rules engine for promotions, category pricing, and dynamic discounts';
COMMENT ON COLUMN pricing_rule.rule_type IS 'Type of pricing rule (category margin, promotion, clearance, etc.)';
COMMENT ON COLUMN pricing_rule.calculation_method IS 'How to calculate price: MARGIN_ON_PTR, DISCOUNT_FROM_MRP, FIXED_PRICE';
COMMENT ON COLUMN pricing_rule.priority IS 'Higher priority rules apply first (1-100, default 10)';
COMMENT ON COLUMN pricing_rule.stackable IS 'Whether this rule can be combined with other rules';

COMMENT ON TABLE pricing_rule_application IS 'Log of pricing rule applications for analytics';

-- Function to get active pricing rules for a product
CREATE OR REPLACE FUNCTION get_active_pricing_rules(
    p_product_id INTEGER,
    p_category VARCHAR,
    p_quantity INTEGER DEFAULT 1,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_id INTEGER,
    rule_code VARCHAR,
    rule_name VARCHAR,
    rule_type pricing_rule_type,
    calculation_method VARCHAR,
    margin_pcnt NUMERIC,
    discount_pcnt NUMERIC,
    fixed_price NUMERIC,
    priority INTEGER,
    stackable BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id,
        pr.rule_code,
        pr.rule_name,
        pr.rule_type,
        pr.calculation_method,
        pr.margin_pcnt,
        pr.discount_pcnt,
        pr.fixed_price,
        pr.priority,
        pr.stackable
    FROM pricing_rule pr
    WHERE pr.active = true
        AND pr.archive = false
        AND pr.status = 'ACTIVE'
        AND p_date BETWEEN pr.valid_from AND pr.valid_to
        AND p_quantity >= pr.min_quantity
        AND (pr.max_quantity IS NULL OR p_quantity <= pr.max_quantity)
        AND (
            (pr.applies_to = 'ALL') OR
            (pr.applies_to = 'CATEGORY' AND pr.category = p_category) OR
            (pr.applies_to = 'PRODUCT' AND pr.product_id = p_product_id)
        )
    ORDER BY pr.priority DESC, pr.created_on ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_pricing_rules IS 'Get all active pricing rules applicable to a product';

-- Function to apply best pricing rule
CREATE OR REPLACE FUNCTION get_best_pricing_rule(
    p_product_id INTEGER,
    p_category VARCHAR,
    p_quantity INTEGER DEFAULT 1,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_id INTEGER,
    rule_code VARCHAR,
    rule_name VARCHAR,
    calculation_method VARCHAR,
    margin_pcnt NUMERIC,
    discount_pcnt NUMERIC,
    fixed_price NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id,
        pr.rule_code,
        pr.rule_name,
        pr.calculation_method,
        pr.margin_pcnt,
        pr.discount_pcnt,
        pr.fixed_price
    FROM pricing_rule pr
    WHERE pr.active = true
        AND pr.archive = false
        AND pr.status = 'ACTIVE'
        AND p_date BETWEEN pr.valid_from AND pr.valid_to
        AND p_quantity >= pr.min_quantity
        AND (pr.max_quantity IS NULL OR p_quantity <= pr.max_quantity)
        AND (
            (pr.applies_to = 'ALL') OR
            (pr.applies_to = 'CATEGORY' AND pr.category = p_category) OR
            (pr.applies_to = 'PRODUCT' AND pr.product_id = p_product_id)
        )
    ORDER BY pr.priority DESC, pr.created_on ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_best_pricing_rule IS 'Get the highest priority pricing rule for a product';

-- Insert sample pricing rules
INSERT INTO pricing_rule
    (rule_code, rule_name, rule_type, applies_to, category, calculation_method, margin_pcnt, status, priority)
VALUES
    ('DRUG-STD-MARGIN', 'Standard Drug Margin', 'CATEGORY_MARGIN', 'CATEGORY', 'Drug', 'MARGIN_ON_PTR', 20.00, 'ACTIVE', 10),
    ('COSMETIC-STD-MARGIN', 'Standard Cosmetic Margin', 'CATEGORY_MARGIN', 'CATEGORY', 'Cosmetic', 'MARGIN_ON_PTR', 30.00, 'ACTIVE', 10),
    ('FMCG-STD-MARGIN', 'Standard FMCG Margin', 'CATEGORY_MARGIN', 'CATEGORY', 'FMCG', 'MARGIN_ON_PTR', 15.00, 'ACTIVE', 10),
    ('CLEARANCE-RULE', 'Expiry Clearance Discount', 'CLEARANCE', 'ALL', NULL, 'DISCOUNT_FROM_MRP', NULL, 'DRAFT', 50)
ON CONFLICT (rule_code) DO NOTHING;

-- Create view for current pricing rules
CREATE OR REPLACE VIEW pricing_rule_current_view AS
SELECT
    pr.id,
    pr.rule_code,
    pr.rule_name,
    pr.rule_type,
    pr.applies_to,
    pr.category,
    pr.product_id,
    CASE
        WHEN pr.product_id IS NOT NULL THEN p.title
        ELSE NULL
    END as product_name,
    pr.calculation_method,
    pr.margin_pcnt,
    pr.discount_pcnt,
    pr.fixed_price,
    pr.min_quantity,
    pr.max_quantity,
    pr.valid_from,
    pr.valid_to,
    pr.priority,
    pr.stackable,
    pr.status,

    -- Days active
    CASE
        WHEN pr.status = 'ACTIVE' THEN CURRENT_DATE - pr.valid_from
        ELSE pr.valid_to - pr.valid_from
    END as days_active,

    -- Days remaining
    CASE
        WHEN pr.status = 'ACTIVE' THEN pr.valid_to - CURRENT_DATE
        ELSE 0
    END as days_remaining,

    pr.created_on,
    pr.created_by
FROM pricing_rule pr
LEFT JOIN product p ON p.id = pr.product_id
WHERE pr.active = true AND pr.archive = false;

COMMENT ON VIEW pricing_rule_current_view IS 'Current active and draft pricing rules with product details';

-- Summary report
SELECT
    'Pricing rules created' as metric,
    COUNT(*) as count
FROM pricing_rule
WHERE active = true;
