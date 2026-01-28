-- Rollback Migration 010: Expiry Monitoring Audit Tables
-- Created: 2026-01-17
-- Purpose: Rollback expiry monitoring audit tables

-- Drop view
DROP VIEW IF EXISTS expiry_monitoring_summary;

-- Drop tables
DROP TABLE IF EXISTS expiry_status_update_log;
DROP TABLE IF EXISTS expiry_check_log;
