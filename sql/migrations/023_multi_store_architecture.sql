-- =====================================================
-- Migration 016: Multi-Tenant & Multi-Store Architecture
-- =====================================================
-- Purpose: Add support for multi-tenancy and multi-store operations
-- Date: 2025-12-07
-- Author: RGP Development Team
--
-- This migration creates the foundation for:
-- - Multiple tenants (businesses) on the same system
-- - Multiple stores per tenant
-- - Store-specific inventory management and reorder limits
-- - Product catalog shared across tenants (master data)
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Create TENANT table
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant (
    id SERIAL PRIMARY KEY,
    tenant_code VARCHAR(20) UNIQUE NOT NULL,
    tenant_name VARCHAR(100) NOT NULL,

    -- Subscription Info
    subscription_plan VARCHAR(50),
    subscription_status VARCHAR(20) DEFAULT 'ACTIVE',
    subscription_start_date DATE,
    subscription_end_date DATE,

    -- Contact Info
    primary_contact_name VARCHAR(100),
    primary_contact_email VARCHAR(100),
    primary_contact_mobile VARCHAR(15),

    -- Settings
    settings JSONB,

    -- Standard Audit Columns
    active BOOLEAN DEFAULT TRUE,
    archive BOOLEAN DEFAULT FALSE,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INTEGER,
    updated_by INTEGER
);

-- Indexes for tenant
CREATE INDEX IF NOT EXISTS idx_tenant_code ON tenant(tenant_code);
CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenant(subscription_status, active);

COMMENT ON TABLE tenant IS 'Master tenant/business table for multi-tenancy support';
COMMENT ON COLUMN tenant.tenant_code IS 'Unique tenant identifier code';
COMMENT ON COLUMN tenant.subscription_status IS 'ACTIVE, SUSPENDED, CANCELLED';

-- =====================================================
-- STEP 2: Create STORE table
-- =====================================================

CREATE TABLE IF NOT EXISTS store (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id),

    store_code VARCHAR(20) NOT NULL,
    store_name VARCHAR(100) NOT NULL,

    -- Location Details
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    pincode VARCHAR(10),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),

    -- Store Type & Status
    store_type VARCHAR(30) DEFAULT 'BRANCH',
    is_main_store BOOLEAN DEFAULT FALSE,
    store_status VARCHAR(20) DEFAULT 'ACTIVE',

    -- Contact Info
    manager_name VARCHAR(100),
    contact_mobile VARCHAR(15),
    contact_email VARCHAR(100),

    -- Operational Settings
    settings JSONB,

    -- Standard Audit Columns
    active BOOLEAN DEFAULT TRUE,
    archive BOOLEAN DEFAULT FALSE,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INTEGER,
    updated_by INTEGER,

    UNIQUE(tenant_id, store_code)
);

-- Indexes for store
CREATE INDEX IF NOT EXISTS idx_store_tenant ON store(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_status ON store(store_status, active);
CREATE INDEX IF NOT EXISTS idx_store_type ON store(store_type);

COMMENT ON TABLE store IS 'Physical store locations for each tenant';
COMMENT ON COLUMN store.store_type IS 'MAIN, BRANCH, WAREHOUSE, FRANCHISE';
COMMENT ON COLUMN store.store_status IS 'ACTIVE, INACTIVE, TEMP_CLOSED';

-- =====================================================
-- STEP 3: Create PRODUCT_STORE_CONFIG table
-- =====================================================

CREATE TABLE IF NOT EXISTS product_store_config (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES store(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,

    -- Inventory Management
    reorder_limit INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    optimal_stock_level INTEGER,

    -- Purchasing Parameters
    lead_time_days INTEGER DEFAULT 7,
    preferred_vendor_id INTEGER REFERENCES vendor(id),

    -- Store-Specific Flags
    is_available_in_store BOOLEAN DEFAULT TRUE,
    is_fast_moving BOOLEAN DEFAULT FALSE,

    -- Store-Specific Pricing (optional override)
    store_price DECIMAL(10, 2),

    -- Configuration Notes
    config_notes TEXT,
    settings JSONB,

    -- Standard Audit Columns
    active BOOLEAN DEFAULT TRUE,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INTEGER,
    updated_by INTEGER,

    UNIQUE(store_id, product_id)
);

-- Indexes for product_store_config
CREATE INDEX IF NOT EXISTS idx_psc_store ON product_store_config(store_id);
CREATE INDEX IF NOT EXISTS idx_psc_product ON product_store_config(product_id);
CREATE INDEX IF NOT EXISTS idx_psc_available ON product_store_config(store_id, product_id)
    WHERE is_available_in_store = TRUE AND active = TRUE;
CREATE INDEX IF NOT EXISTS idx_psc_reorder ON product_store_config(store_id)
    WHERE active = TRUE AND is_available_in_store = TRUE;

COMMENT ON TABLE product_store_config IS 'Store-specific product configuration including reorder limits';
COMMENT ON COLUMN product_store_config.reorder_limit IS 'Trigger reorder when stock falls below this level';
COMMENT ON COLUMN product_store_config.optimal_stock_level IS 'Target stock level for this product in this store';

-- =====================================================
-- STEP 4: Add store_id to existing transactional tables
-- =====================================================

-- Add store_id to sales_intent (nullable initially)
ALTER TABLE sales_intent
    ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES store(id);

CREATE INDEX IF NOT EXISTS idx_salesintent_store ON sales_intent(store_id);

COMMENT ON COLUMN sales_intent.store_id IS 'Store requesting this purchase intent';

-- Add store_id to purchase_order (nullable initially)
ALTER TABLE purchase_order
    ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES store(id);

CREATE INDEX IF NOT EXISTS idx_po_store ON purchase_order(store_id);

COMMENT ON COLUMN purchase_order.store_id IS 'Store for which this purchase order is created';

-- Add store_id to purchase_invoice (nullable initially)
ALTER TABLE purchase_invoice
    ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES store(id);

CREATE INDEX IF NOT EXISTS idx_pi_store ON purchase_invoice(store_id);

COMMENT ON COLUMN purchase_invoice.store_id IS 'Store receiving the goods';

-- Add store_id to sale (nullable initially)
ALTER TABLE sale
    ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES store(id);

CREATE INDEX IF NOT EXISTS idx_sale_store ON sale(store_id);

COMMENT ON COLUMN sale.store_id IS 'Store where sale was made';

-- =====================================================
-- STEP 5: Insert default tenant and store
-- =====================================================

-- Insert default tenant (RGP Pharmacy)
INSERT INTO tenant (
    id,
    tenant_code,
    tenant_name,
    subscription_status,
    subscription_start_date,
    primary_contact_name,
    primary_contact_email,
    created_by
) VALUES (
    1,
    'RGP001',
    'RGP Pharmacy',
    'ACTIVE',
    CURRENT_DATE,
    'Admin User',
    'admin@rgp.com',
    1
) ON CONFLICT (id) DO NOTHING;

-- Reset sequence if needed
SELECT setval('tenant_id_seq', (SELECT MAX(id) FROM tenant));

-- Insert default main store
INSERT INTO store (
    id,
    tenant_id,
    store_code,
    store_name,
    store_type,
    is_main_store,
    store_status,
    address,
    city,
    created_by
) VALUES (
    1,
    1,
    'MAIN',
    'Main Store',
    'MAIN',
    TRUE,
    'ACTIVE',
    'Main Branch Location',
    'Chennai',
    1
) ON CONFLICT ON CONSTRAINT store_tenant_id_store_code_key DO NOTHING;

-- Reset sequence if needed
SELECT setval('store_id_seq', (SELECT MAX(id) FROM store));

-- =====================================================
-- STEP 6: Backfill existing data with default store
-- =====================================================

-- Update existing sales_intent records with default store
UPDATE sales_intent
SET store_id = 1
WHERE store_id IS NULL;

-- Update existing purchase_order records with default store
UPDATE purchase_order
SET store_id = 1
WHERE store_id IS NULL;

-- Update existing purchase_invoice records with default store
UPDATE purchase_invoice
SET store_id = 1
WHERE store_id IS NULL;

-- Update existing sale records with default store
UPDATE sale
SET store_id = 1
WHERE store_id IS NULL;

-- =====================================================
-- STEP 7: Create store-aware views
-- =====================================================

-- This view will be created in a separate migration after stock tracking is updated
-- For now, we'll create a placeholder comment

COMMENT ON TABLE product_store_config IS
'Store-specific product configuration. Views for low stock detection will be added after stock tracking updates.';

-- =====================================================
-- Migration Complete
-- =====================================================

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (run these manually to verify)
-- =====================================================

-- Check tenant and store creation
-- SELECT * FROM tenant;
-- SELECT * FROM store;

-- Check that store_id was added to transactional tables
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('sales_intent', 'purchase_order', 'purchase_invoice', 'sale')
--   AND column_name = 'store_id';

-- Check indexes
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE indexname LIKE '%store%'
-- ORDER BY tablename, indexname;

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- Run this if you need to rollback the migration:
/*
BEGIN;

DROP TABLE IF EXISTS product_store_config CASCADE;
DROP TABLE IF EXISTS store CASCADE;
DROP TABLE IF EXISTS tenant CASCADE;

ALTER TABLE sales_intent DROP COLUMN IF EXISTS store_id;
ALTER TABLE purchase_order DROP COLUMN IF EXISTS store_id;
ALTER TABLE purchase_invoice DROP COLUMN IF EXISTS store_id;
ALTER TABLE sale DROP COLUMN IF EXISTS store_id;

COMMIT;
*/
