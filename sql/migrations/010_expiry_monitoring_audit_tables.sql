-- Migration 010: Expiry Monitoring Audit Tables
-- Created: 2026-01-17
-- Purpose: Audit tables for expiry monitoring cron jobs
-- Issue: #127 - Batch/Expiry Tracking with FEFO Enforcement

-- Table: expiry_check_log
-- Stores daily near-expiry check results
CREATE TABLE IF NOT EXISTS expiry_check_log (
  id SERIAL PRIMARY KEY,
  batches_30_days INTEGER NOT NULL DEFAULT 0,
  batches_60_days INTEGER NOT NULL DEFAULT 0,
  batches_90_days INTEGER NOT NULL DEFAULT 0,
  value_at_risk_30 NUMERIC(12,2) DEFAULT 0,
  value_at_risk_60 NUMERIC(12,2) DEFAULT 0,
  value_at_risk_90 NUMERIC(12,2) DEFAULT 0,
  checked_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT expiry_check_log_positive_counts CHECK (
    batches_30_days >= 0 AND
    batches_60_days >= 0 AND
    batches_90_days >= 0
  )
);

-- Index for date-based queries
CREATE INDEX idx_expiry_check_log_date ON expiry_check_log(checked_on DESC);

-- Table: expiry_status_update_log
-- Stores daily expiry status update results
CREATE TABLE IF NOT EXISTS expiry_status_update_log (
  id SERIAL PRIMARY KEY,
  batches_expired INTEGER NOT NULL DEFAULT 0,
  total_quantity_expired INTEGER NOT NULL DEFAULT 0,
  updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT expiry_status_update_log_positive CHECK (
    batches_expired >= 0 AND
    total_quantity_expired >= 0
  )
);

-- Index for date-based queries
CREATE INDEX idx_expiry_status_update_log_date ON expiry_status_update_log(updated_on DESC);

-- Comments for documentation
COMMENT ON TABLE expiry_check_log IS 'Audit log for daily near-expiry checks (30/60/90 days)';
COMMENT ON TABLE expiry_status_update_log IS 'Audit log for daily batch status updates (ACTIVE -> EXPIRED)';

COMMENT ON COLUMN expiry_check_log.batches_30_days IS 'Number of batches expiring within 30 days (CRITICAL)';
COMMENT ON COLUMN expiry_check_log.batches_60_days IS 'Number of batches expiring within 60 days (WARNING)';
COMMENT ON COLUMN expiry_check_log.batches_90_days IS 'Number of batches expiring within 90 days (CAUTION)';
COMMENT ON COLUMN expiry_check_log.value_at_risk_30 IS 'Total value of batches expiring within 30 days';

COMMENT ON COLUMN expiry_status_update_log.batches_expired IS 'Number of batches marked as EXPIRED';
COMMENT ON COLUMN expiry_status_update_log.total_quantity_expired IS 'Total quantity across all expired batches';

-- View: expiry_monitoring_summary
-- Aggregates monitoring statistics
CREATE OR REPLACE VIEW expiry_monitoring_summary AS
SELECT
  -- Latest check results
  (SELECT batches_30_days FROM expiry_check_log ORDER BY checked_on DESC LIMIT 1) AS current_batches_30_days,
  (SELECT batches_60_days FROM expiry_check_log ORDER BY checked_on DESC LIMIT 1) AS current_batches_60_days,
  (SELECT batches_90_days FROM expiry_check_log ORDER BY checked_on DESC LIMIT 1) AS current_batches_90_days,
  (SELECT value_at_risk_30 FROM expiry_check_log ORDER BY checked_on DESC LIMIT 1) AS current_value_at_risk,

  -- Historical trends (last 7 days)
  (SELECT AVG(batches_30_days)::INTEGER FROM expiry_check_log WHERE checked_on >= CURRENT_DATE - INTERVAL '7 days') AS avg_batches_30_days_7d,
  (SELECT AVG(value_at_risk_30)::NUMERIC(12,2) FROM expiry_check_log WHERE checked_on >= CURRENT_DATE - INTERVAL '7 days') AS avg_value_at_risk_7d,

  -- Total expired (last 30 days)
  (SELECT COALESCE(SUM(batches_expired), 0) FROM expiry_status_update_log WHERE updated_on >= CURRENT_DATE - INTERVAL '30 days') AS total_expired_30d,
  (SELECT COALESCE(SUM(total_quantity_expired), 0) FROM expiry_status_update_log WHERE updated_on >= CURRENT_DATE - INTERVAL '30 days') AS total_qty_expired_30d,

  -- Last run timestamps
  (SELECT MAX(checked_on) FROM expiry_check_log) AS last_check_run,
  (SELECT MAX(updated_on) FROM expiry_status_update_log) AS last_status_update;

COMMENT ON VIEW expiry_monitoring_summary IS 'Summary of expiry monitoring statistics and trends';

-- Grant permissions (adjust as needed)
-- GRANT SELECT ON expiry_check_log TO your_read_role;
-- GRANT SELECT ON expiry_status_update_log TO your_read_role;
-- GRANT SELECT ON expiry_monitoring_summary TO your_read_role;
