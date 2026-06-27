-- Supports composition-prefix and contains searches in the sale stock selector.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_composition_trgm
    ON product USING gin ((more_props->>'composition') gin_trgm_ops)
    WHERE active = true AND archive = false;

ANALYZE product;
