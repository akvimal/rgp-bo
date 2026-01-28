-- Migration 013: Stock Variance Monitoring
-- Created: 2026-01-17
-- Purpose: Track unusual stock movements and variance alerts
-- Issue: #125 - Stock variance detection & monitoring

-- Create stock_variance_log table
CREATE TABLE IF NOT EXISTS stock_variance_log (
  id SERIAL PRIMARY KEY,

  -- Check details
  check_date DATE NOT NULL,
  total_adjustments INTEGER NOT NULL DEFAULT 0,
  large_adjustments INTEGER NOT NULL DEFAULT 0,
  after_hours_movements INTEGER NOT NULL DEFAULT 0,
  users_with_high_activity INTEGER NOT NULL DEFAULT 0,

  -- Financial impact
  total_value_at_risk NUMERIC(12,2) DEFAULT 0,

  -- Alert summary
  alerts_generated INTEGER NOT NULL DEFAULT 0,

  -- Audit
  checked_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_adjustments CHECK (
    total_adjustments >= 0 AND
    large_adjustments >= 0 AND
    after_hours_movements >= 0 AND
    users_with_high_activity >= 0 AND
    alerts_generated >= 0
  ),
  CONSTRAINT unique_check_date UNIQUE (check_date)
);

-- Indexes for performance
CREATE INDEX idx_stock_variance_log_date ON stock_variance_log(check_date DESC);
CREATE INDEX idx_stock_variance_log_alerts ON stock_variance_log(alerts_generated DESC) WHERE alerts_generated > 0;

-- Comments for documentation
COMMENT ON TABLE stock_variance_log IS 'Daily stock variance monitoring log';
COMMENT ON COLUMN stock_variance_log.check_date IS 'Date being monitored (previous day)';
COMMENT ON COLUMN stock_variance_log.total_adjustments IS 'Total number of stock adjustments made';
COMMENT ON COLUMN stock_variance_log.large_adjustments IS 'Number of adjustments exceeding threshold (>100 units)';
COMMENT ON COLUMN stock_variance_log.after_hours_movements IS 'Number of adjustments made outside business hours';
COMMENT ON COLUMN stock_variance_log.users_with_high_activity IS 'Number of users with >5 adjustments per hour';
COMMENT ON COLUMN stock_variance_log.total_value_at_risk IS 'Total value of large negative adjustments';
COMMENT ON COLUMN stock_variance_log.alerts_generated IS 'Number of variance alerts generated';

-- View: stock_variance_summary
-- Provides quick summary of variance monitoring
CREATE OR REPLACE VIEW stock_variance_summary AS
SELECT
  -- Latest check
  (SELECT check_date FROM stock_variance_log ORDER BY check_date DESC LIMIT 1) AS last_check_date,
  (SELECT alerts_generated FROM stock_variance_log ORDER BY check_date DESC LIMIT 1) AS recent_alerts,

  -- Last 7 days statistics
  (SELECT COALESCE(SUM(total_adjustments), 0) FROM stock_variance_log
   WHERE check_date >= CURRENT_DATE - INTERVAL '7 days') AS total_adjustments_7d,
  (SELECT COALESCE(SUM(large_adjustments), 0) FROM stock_variance_log
   WHERE check_date >= CURRENT_DATE - INTERVAL '7 days') AS large_adjustments_7d,
  (SELECT COALESCE(SUM(alerts_generated), 0) FROM stock_variance_log
   WHERE check_date >= CURRENT_DATE - INTERVAL '7 days') AS total_alerts_7d,
  (SELECT COALESCE(SUM(total_value_at_risk), 0) FROM stock_variance_log
   WHERE check_date >= CURRENT_DATE - INTERVAL '7 days') AS value_at_risk_7d,

  -- Last 30 days statistics
  (SELECT COALESCE(SUM(total_adjustments), 0) FROM stock_variance_log
   WHERE check_date >= CURRENT_DATE - INTERVAL '30 days') AS total_adjustments_30d,
  (SELECT COALESCE(SUM(total_value_at_risk), 0) FROM stock_variance_log
   WHERE check_date >= CURRENT_DATE - INTERVAL '30 days') AS value_at_risk_30d;

COMMENT ON VIEW stock_variance_summary IS 'Summary statistics for stock variance monitoring';

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT ON stock_variance_log TO your_app_role;
-- GRANT SELECT ON stock_variance_summary TO your_app_role;

