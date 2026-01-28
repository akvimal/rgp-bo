-- =====================================================
-- HR Policy & Benefits Management Schema - ROLLBACK
-- Migration: 006_rollback
-- Description: Rollback script for HR policy and benefits schema
-- Created: 2026-01-13
-- =====================================================

-- WARNING: This will drop all HR policy and benefits data!
-- Use with caution, preferably only on development/test environments

BEGIN;

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS hr_policy_acknowledgment CASCADE;
DROP TABLE IF EXISTS benefit_claim CASCADE;
DROP TABLE IF EXISTS employee_benefit_enrollment CASCADE;
DROP TABLE IF EXISTS policy_eligibility_rule CASCADE;
DROP TABLE IF EXISTS benefit_policy CASCADE;
DROP TABLE IF EXISTS benefit_master CASCADE;
DROP TABLE IF EXISTS hr_policy_master CASCADE;

SELECT 'HR Policy & Benefits schema rolled back successfully!' as status;

COMMIT;
