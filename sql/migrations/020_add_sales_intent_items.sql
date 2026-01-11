-- Migration: Add support for multiple products per sales intent
-- Description: Create sales_intent_item table and migrate existing data
-- Date: 2025-12-07

-- ========================================
-- 1. Create sales_intent_item table
-- ========================================

CREATE TABLE IF NOT EXISTS sales_intent_item (
    id SERIAL PRIMARY KEY,
    intent_id INTEGER NOT NULL REFERENCES sales_intent(id) ON DELETE CASCADE,

    -- Product information
    prodid INTEGER REFERENCES product(id) ON DELETE RESTRICT,
    productname VARCHAR(100) NOT NULL,
    requestedqty INTEGER NOT NULL CHECK (requestedqty > 0),
    estimatedcost NUMERIC(10,2),

    -- Notes specific to this item
    item_notes TEXT,

    -- Standard audit fields
    active BOOLEAN NOT NULL DEFAULT true,
    archive BOOLEAN NOT NULL DEFAULT false,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES app_user(id),
    updated_by INTEGER REFERENCES app_user(id)
);

-- Add indexes for better query performance
CREATE INDEX idx_salesintentitem_intentid ON sales_intent_item(intent_id);
CREATE INDEX idx_salesintentitem_prodid ON sales_intent_item(prodid);
CREATE INDEX idx_salesintentitem_active ON sales_intent_item(active);

-- ========================================
-- 2. Migrate existing single-product data to items table
-- ========================================

-- Copy existing product data from sales_intent to sales_intent_item
INSERT INTO sales_intent_item
    (intent_id, prodid, productname, requestedqty, estimatedcost, created_by, created_on, updated_on)
SELECT
    id,
    prodid,
    productname,
    requestedqty,
    estimatedcost,
    created_by,
    created_on,
    updated_on
FROM sales_intent
WHERE active = true;

-- ========================================
-- 3. Archive the old columns (keep for backward compatibility temporarily)
-- ========================================

-- We'll keep the old columns for now but they won't be used
-- They can be dropped in a future migration after verifying the new structure works

COMMENT ON COLUMN sales_intent.prodid IS 'DEPRECATED: Use sales_intent_item table instead';
COMMENT ON COLUMN sales_intent.productname IS 'DEPRECATED: Use sales_intent_item table instead';
COMMENT ON COLUMN sales_intent.requestedqty IS 'DEPRECATED: Use sales_intent_item table instead';
COMMENT ON COLUMN sales_intent.estimatedcost IS 'DEPRECATED: Use sales_intent_item table instead';

-- ========================================
-- 4. Add summary columns to sales_intent (optional)
-- ========================================

ALTER TABLE sales_intent ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0;
ALTER TABLE sales_intent ADD COLUMN IF NOT EXISTS total_estimated_cost NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN sales_intent.total_items IS 'Total number of different products in this intent';
COMMENT ON COLUMN sales_intent.total_estimated_cost IS 'Sum of (estimatedcost * requestedqty) for all items';

-- ========================================
-- 5. Update summary columns based on items
-- ========================================

UPDATE sales_intent SET
    total_items = (SELECT COUNT(*) FROM sales_intent_item WHERE intent_id = sales_intent.id AND active = true),
    total_estimated_cost = (
        SELECT COALESCE(SUM(estimatedcost * requestedqty), 0)
        FROM sales_intent_item
        WHERE intent_id = sales_intent.id AND active = true
    );

-- ========================================
-- 6. Grant permissions
-- ========================================

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_intent_item TO rgpapp;
GRANT USAGE, SELECT ON SEQUENCE sales_intent_item_id_seq TO rgpapp;

-- ========================================
-- Migration Complete
-- ========================================

-- Verify migration
DO $$
DECLARE
    intent_count INTEGER;
    item_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO intent_count FROM sales_intent WHERE active = true;
    SELECT COUNT(*) INTO item_count FROM sales_intent_item WHERE active = true;

    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '  Active Sales Intents: %', intent_count;
    RAISE NOTICE '  Sales Intent Items: %', item_count;

    IF intent_count = item_count THEN
        RAISE NOTICE '  ✓ Data migration successful - counts match';
    ELSE
        RAISE WARNING '  ⚠ Data mismatch - please verify migration';
    END IF;
END $$;
