-- Sprint 2: Add FK indexes and fix erroneous unique constraints
-- Date: 2026-08-03

-- Fix erroneous unique constraints that allowed only one record per vendor
ALTER TABLE purchase_invoice DROP CONSTRAINT IF EXISTS purchase_invoice_vendor_id_key;
ALTER TABLE purchase_order   DROP CONSTRAINT IF EXISTS purchase_order_vendor_id_key;

-- Sale table: indexes on FK columns used in WHERE/JOIN
CREATE INDEX IF NOT EXISTS sale_customer_idx      ON sale (customer_id);
CREATE INDEX IF NOT EXISTS sale_shift_idx         ON sale (shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sale_acting_user_idx   ON sale (acting_user_id) WHERE acting_user_id IS NOT NULL;

-- Vendor payment: indexes on FK columns
CREATE INDEX IF NOT EXISTS vendor_payment_vendor_idx  ON vendor_payment (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_payment_invoice_idx ON vendor_payment (invoice_id);

-- Purchase request: indexes on FK columns
CREATE INDEX IF NOT EXISTS purchase_request_product_idx ON purchase_request (product_id);
CREATE INDEX IF NOT EXISTS purchase_request_order_idx   ON purchase_request (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS purchase_request_vendor_idx  ON purchase_request (vendor_id) WHERE vendor_id IS NOT NULL;

-- Purchase order: non-unique index on vendor_id (replaces erroneous unique constraint)
CREATE INDEX IF NOT EXISTS purchase_order_vendor_idx ON purchase_order (vendor_id);
