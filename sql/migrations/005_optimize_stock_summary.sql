-- Supports the six-month product sales aggregation used by POST /stock2.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_recent_complete
    ON sale (bill_date DESC, id)
    WHERE active = true AND archive = false AND status = 'COMPLETE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_sale_product_active
    ON sale_item (sale_id, product_id)
    WHERE active = true AND archive = false;

ANALYZE sale;
ANALYZE sale_item;
