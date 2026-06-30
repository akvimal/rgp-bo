-- Supports index-only item aggregation for the purchase invoice list.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_item_invoice_totals
    ON purchase_invoice_item (invoice_id)
    INCLUDE (qty, ptr_cost, disc_pcnt)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_list_date
    ON purchase_invoice (invoice_date DESC, id)
    WHERE active = true AND archive = false;

ANALYZE purchase_invoice;
ANALYZE purchase_invoice_item;
