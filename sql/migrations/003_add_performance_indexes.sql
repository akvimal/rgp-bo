-- ============================================================================
-- Migration: 003_add_performance_indexes.sql
-- Description: Add critical indexes to improve query performance
-- Date: 2025-10-19
-- Impact: Significant performance improvement for queries and joins
-- Execution Time: ~5-30 minutes depending on data volume
--
-- IMPORTANT: This migration uses CREATE INDEX CONCURRENTLY to avoid locking
-- tables during index creation. This is safe for production but requires:
-- 1. Cannot be run inside a transaction block
-- 2. May take longer to complete
-- 3. Monitor progress with: SELECT * FROM pg_stat_progress_create_index;
-- ============================================================================

-- ============================================================================
-- SECTION 1: CRITICAL INDEXES - Foreign Keys and Primary Join Columns
-- These indexes are essential for basic query performance
-- ============================================================================

-- Sale table indexes
-- Purpose: Optimize customer lookups, status filters, and date-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_customer_id
    ON sale(customer_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_status
    ON sale(status)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_bill_date
    ON sale(bill_date DESC)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_created_by
    ON sale(created_by)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_bill_no
    ON sale(bill_no)
    WHERE active = true AND archive = false;

-- Sale_item table indexes
-- Purpose: Optimize joins between sales, inventory, and products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_sale_id
    ON sale_item(sale_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_purchase_item_id
    ON sale_item(purchase_item_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_product_id
    ON sale_item(product_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_status
    ON sale_item(status)
    WHERE active = true AND archive = false;

-- Composite index for inventory_view WHERE clause (status + purchase_item_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_item_status_purchase_item
    ON sale_item(status, purchase_item_id)
    WHERE active = true AND archive = false;

-- Sale_return_item table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_return_item_sale_item_id
    ON sale_return_item(sale_item_id)
    WHERE active = true AND archive = false;

-- Purchase invoice indexes
-- Purpose: Optimize vendor lookups, date sorting, and status filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_vendor_id
    ON purchase_invoice(vendor_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_date
    ON purchase_invoice(invoice_date DESC)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_status
    ON purchase_invoice(status)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_no
    ON purchase_invoice(invoice_no)
    WHERE active = true AND archive = false;

-- Purchase invoice item indexes
-- Purpose: Critical for inventory tracking, stock queries, and expiry checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_item_invoice_id
    ON purchase_invoice_item(invoice_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_item_product_id
    ON purchase_invoice_item(product_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_item_status
    ON purchase_invoice_item(status)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_item_exp_date
    ON purchase_invoice_item(exp_date)
    WHERE active = true AND archive = false;

-- Composite index for batch/expiry lookups (common in stock queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_item_batch_lookup
    ON purchase_invoice_item(product_id, batch, exp_date)
    WHERE active = true AND archive = false;

-- Composite index for verified items (used in stock_view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_item_verified
    ON purchase_invoice_item(status, product_id)
    WHERE active = true AND archive = false AND status = 'VERIFIED';

-- ============================================================================
-- SECTION 2: PRODUCT & INVENTORY INDEXES
-- These indexes optimize product searches and inventory management
-- ============================================================================

-- Product table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_active
    ON product(active)
    WHERE archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_category
    ON product(category)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_title
    ON product(title)
    WHERE active = true AND archive = false;

-- Product code for barcode scanning
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_code
    ON product(product_code)
    WHERE active = true AND archive = false;

-- HSN code for tax reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_hsn
    ON product(hsn_code)
    WHERE active = true AND archive = false;

-- Product price indexes
-- Purpose: Optimize price lookups with date filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_price2_product_dates
    ON product_price2(product_id, eff_date DESC, end_date DESC)
    WHERE active = true AND archive = false;

-- Index for current prices (end_date > CURRENT_DATE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_price2_current
    ON product_price2(product_id, end_date)
    WHERE active = true AND archive = false AND end_date > CURRENT_DATE;

-- Product quantity change indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_qtychange_item_id
    ON product_qtychange(item_id)
    WHERE active = true AND archive = false;

-- Product clearance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_clearance_purchase_item
    ON product_clearance(purchase_item_id)
    WHERE active = true AND archive = false;

-- ============================================================================
-- SECTION 3: CUSTOMER & VENDOR INDEXES
-- These indexes optimize customer/vendor lookups and reporting
-- ============================================================================

-- Customer indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_mobile
    ON customer(mobile)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_name
    ON customer(name)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_email
    ON customer(email)
    WHERE active = true AND archive = false;

-- Customer transaction indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_transaction_customer_id
    ON customer_transaction(customer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_transaction_date
    ON customer_transaction(trans_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_transaction_category
    ON customer_transaction(category, trans_date DESC);

-- Customer documents indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_documents_customer_id
    ON customer_documents(customer_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_documents_document_id
    ON customer_documents(document_id)
    WHERE active = true AND archive = false;

-- Vendor indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_business_name
    ON vendor(business_name)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_gstn
    ON vendor(gstn)
    WHERE active = true AND archive = false;

-- Vendor payment indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_payment_vendor_id
    ON vendor_payment(vendor_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_payment_invoice_id
    ON vendor_payment(invoice_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_payment_date
    ON vendor_payment(pay_date DESC);

-- Vendor pricelist indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_pricelist_vendor_id
    ON vendor_pricelist(vendor_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_pricelist_product_id
    ON vendor_pricelist(product_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_pricelist_composite
    ON vendor_pricelist(vendor_id, product_id, eff_date DESC);

-- ============================================================================
-- SECTION 4: DELIVERY & ORDER INDEXES
-- These indexes optimize delivery and order management queries
-- ============================================================================

-- Sale deliveries indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_deliveries_sale_id
    ON sale_deliveries("saleId")
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_deliveries_status
    ON sale_deliveries(status)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_deliveries_booked_by
    ON sale_deliveries(booked_by)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_deliveries_delivery_date
    ON sale_deliveries(delivery_date)
    WHERE active = true AND archive = false;

-- Purchase order indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_vendor_id
    ON purchase_order(vendor_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_status
    ON purchase_order(status)
    WHERE active = true AND archive = false;

-- Purchase request indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_request_product_id
    ON purchase_request(product_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_request_order_id
    ON purchase_request(order_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_request_status
    ON purchase_request(status)
    WHERE active = true AND archive = false;

-- ============================================================================
-- SECTION 5: USER & ROLE INDEXES
-- These indexes optimize authentication and authorization queries
-- ============================================================================

-- App user indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_user_email
    ON app_user(email)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_user_role_id
    ON app_user(role_id)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_user_last_login
    ON app_user(last_login DESC)
    WHERE active = true AND archive = false;

-- App role indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_role_name
    ON app_role(name)
    WHERE active = true AND archive = false;

-- Documents indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_category
    ON documents(category)
    WHERE active = true AND archive = false;

-- ============================================================================
-- SECTION 6: TEXT SEARCH INDEXES (OPTIONAL)
-- These indexes optimize ILIKE/text search queries
-- Requires pg_trgm extension
-- ============================================================================

-- Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Product title search (for ILIKE queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_title_trgm
    ON product USING gin(title gin_trgm_ops)
    WHERE active = true AND archive = false;

-- Customer name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_name_trgm
    ON customer USING gin(name gin_trgm_ops)
    WHERE active = true AND archive = false;

-- Vendor business name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_business_name_trgm
    ON vendor USING gin(business_name gin_trgm_ops)
    WHERE active = true AND archive = false;

-- ============================================================================
-- SECTION 7: AUDIT & TRACKING INDEXES
-- These indexes support audit trails and change tracking
-- ============================================================================

-- Created/Updated tracking indexes for major tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_created_on
    ON sale(created_on DESC)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_created_on
    ON purchase_invoice(created_on DESC)
    WHERE active = true AND archive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_updated_on
    ON product(updated_on DESC)
    WHERE active = true AND archive = false;

-- ============================================================================
-- VERIFY INDEX CREATION
-- Run this query to verify all indexes were created successfully
-- ============================================================================

-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--     AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- ============================================================================
-- PERFORMANCE MONITORING
-- Run these queries to monitor index usage after deployment
-- ============================================================================

-- Check index usage statistics
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     idx_scan as index_scans,
--     idx_tup_read as tuples_read,
--     idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- Find unused indexes (run after 1 week)
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     idx_scan
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--     AND idx_scan = 0
--     AND indexname NOT LIKE '%_pkey'
-- ORDER BY tablename, indexname;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
