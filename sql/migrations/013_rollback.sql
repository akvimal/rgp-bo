-- Rollback Migration 013: Stock Variance Monitoring
-- Created: 2026-01-17
-- Purpose: Remove stock variance monitoring tables and views

-- Drop view
DROP VIEW IF EXISTS stock_variance_summary;

-- Drop indexes
DROP INDEX IF EXISTS idx_stock_variance_log_date;
DROP INDEX IF EXISTS idx_stock_variance_log_alerts;

-- Drop table
DROP TABLE IF EXISTS stock_variance_log;

