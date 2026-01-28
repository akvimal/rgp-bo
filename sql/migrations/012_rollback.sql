-- Rollback Migration 012: Pricing Rule Application Log
-- Created: 2026-01-17
-- Purpose: Remove pricing rule application log table

-- Drop indexes
DROP INDEX IF EXISTS idx_pricing_rule_app_rule;
DROP INDEX IF EXISTS idx_pricing_rule_app_product;
DROP INDEX IF EXISTS idx_pricing_rule_app_sale;
DROP INDEX IF EXISTS idx_pricing_rule_app_date;

-- Drop table
DROP TABLE IF EXISTS pricing_rule_application;

