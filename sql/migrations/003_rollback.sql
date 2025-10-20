-- ============================================================================
-- Rollback Migration: 003_rollback.sql
-- Description: Remove performance indexes added in 003_add_performance_indexes.sql
-- Date: 2025-10-19
-- Impact: Will degrade query performance - only use if absolutely necessary
--
-- WARNING: Rolling back these indexes will significantly impact performance.
-- Only execute this if you need to troubleshoot index-related issues.
-- ============================================================================

-- ============================================================================
-- SECTION 1: DROP SALE-RELATED INDEXES
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_sale_customer_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_bill_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_created_by;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_bill_no;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_created_on;

DROP INDEX CONCURRENTLY IF EXISTS idx_sale_item_sale_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_item_purchase_item_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_item_product_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_item_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_item_status_purchase_item;

DROP INDEX CONCURRENTLY IF EXISTS idx_sale_return_item_sale_item_id;

-- ============================================================================
-- SECTION 2: DROP PURCHASE-RELATED INDEXES
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_vendor_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_no;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_created_on;

DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_item_invoice_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_item_product_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_item_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_item_exp_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_item_batch_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_invoice_item_verified;

-- ============================================================================
-- SECTION 3: DROP PRODUCT & INVENTORY INDEXES
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_product_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_category;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_title;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_code;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_hsn;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_updated_on;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_title_trgm;

DROP INDEX CONCURRENTLY IF EXISTS idx_product_price2_product_dates;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_price2_current;

DROP INDEX CONCURRENTLY IF EXISTS idx_product_qtychange_item_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_clearance_purchase_item;

-- ============================================================================
-- SECTION 4: DROP CUSTOMER & VENDOR INDEXES
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_customer_mobile;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_email;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_name_trgm;

DROP INDEX CONCURRENTLY IF EXISTS idx_customer_transaction_customer_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_transaction_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_transaction_category;

DROP INDEX CONCURRENTLY IF EXISTS idx_customer_documents_customer_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_customer_documents_document_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_business_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_gstn;
DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_business_name_trgm;

DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_payment_vendor_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_payment_invoice_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_payment_date;

DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_pricelist_vendor_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_pricelist_product_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_pricelist_composite;

-- ============================================================================
-- SECTION 5: DROP DELIVERY & ORDER INDEXES
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_sale_deliveries_sale_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_deliveries_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_deliveries_booked_by;
DROP INDEX CONCURRENTLY IF EXISTS idx_sale_deliveries_delivery_date;

DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_order_vendor_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_order_status;

DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_request_product_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_request_order_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_purchase_request_status;

-- ============================================================================
-- SECTION 6: DROP USER & ROLE INDEXES
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_app_user_email;
DROP INDEX CONCURRENTLY IF EXISTS idx_app_user_role_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_app_user_last_login;

DROP INDEX CONCURRENTLY IF EXISTS idx_app_role_name;

DROP INDEX CONCURRENTLY IF EXISTS idx_documents_category;

-- ============================================================================
-- SECTION 7: DROP TRIGRAM EXTENSION (OPTIONAL)
-- ============================================================================

-- WARNING: Only drop this if no other indexes or applications use it
-- DROP EXTENSION IF EXISTS pg_trgm;

-- ============================================================================
-- VERIFY ROLLBACK
-- Run this query to verify indexes were removed
-- ============================================================================

-- SELECT
--     schemaname,
--     tablename,
--     indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--     AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
