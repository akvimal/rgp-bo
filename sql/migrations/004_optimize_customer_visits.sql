-- Supports recent customer visits and per-customer interval calculations.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_customer_visit_history
    ON sale (customer_id, bill_date DESC)
    WHERE active = true AND archive = false AND status = 'COMPLETE';

ANALYZE sale;
