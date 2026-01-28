-- Migration 012: Pricing Rule Application Log
-- Created: 2026-01-17
-- Purpose: Track pricing rule applications in sales for audit and analytics
-- Issue: #123 - Strict pricing rule enforcement

-- Create pricing_rule_application table
CREATE TABLE IF NOT EXISTS pricing_rule_application (
  id SERIAL PRIMARY KEY,

  -- Rule reference
  pricing_rule_id INTEGER REFERENCES pricing_rule(id),

  -- Product and transaction reference
  product_id INTEGER NOT NULL REFERENCES product(id),
  sale_id INTEGER REFERENCES sale(id),
  sale_item_id INTEGER REFERENCES sale_item(id),

  -- Pricing details
  original_price NUMERIC(10,2),
  calculated_price NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2),
  margin_pcnt NUMERIC(5,2),
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Application details
  applied_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_by INTEGER REFERENCES app_user(id),

  -- Audit
  active BOOLEAN DEFAULT true NOT NULL,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES app_user(id),

  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_price CHECK (calculated_price > 0)
);

-- Indexes for performance
CREATE INDEX idx_pricing_rule_app_rule ON pricing_rule_application(pricing_rule_id, applied_on DESC);
CREATE INDEX idx_pricing_rule_app_product ON pricing_rule_application(product_id, applied_on DESC);
CREATE INDEX idx_pricing_rule_app_sale ON pricing_rule_application(sale_id);
CREATE INDEX idx_pricing_rule_app_date ON pricing_rule_application(applied_on DESC);

-- Comments
COMMENT ON TABLE pricing_rule_application IS 'Audit log of pricing rule applications in sales';
COMMENT ON COLUMN pricing_rule_application.pricing_rule_id IS 'Reference to applied pricing rule (NULL if default pricing used)';
COMMENT ON COLUMN pricing_rule_application.original_price IS 'Original price before rule application (if any)';
COMMENT ON COLUMN pricing_rule_application.calculated_price IS 'Final calculated price after rule application';
COMMENT ON COLUMN pricing_rule_application.applied_on IS 'Timestamp when rule was applied';

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT ON pricing_rule_application TO your_app_role;

