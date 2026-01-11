-- Migration 012: Update Medicine GST Rates to 5% (GST 2.0 - Effective Sep 22, 2025)
-- Purpose: Implement GST Council notification for medicine rate reduction
-- Author: System
-- Date: 2025-12-06
-- Reference: GST 2.0 effective from September 22, 2025
--
-- IMPORTANT: This migration implements time-based tax rates
-- - Old invoices (before Sep 22, 2025) will use 12% rate
-- - New invoices (on/after Sep 22, 2025) will use 5% rate
-- This ensures historical accuracy for tax audits and ITC claims

BEGIN;

-- ============================================================================
-- STEP 1: Close Previous Medicine Tax Rates (12%)
-- ============================================================================

UPDATE hsn_tax_master
SET
    effective_to = '2025-09-21',
    updated_on = CURRENT_TIMESTAMP
WHERE
    tax_category = 'MEDICINE'
    AND effective_to = '2099-12-31'
    AND (cgst_rate = 6 AND sgst_rate = 6 AND igst_rate = 12);

-- Verify closure
SELECT
    'Closed 12% Medicine Rates' as action,
    COUNT(*) as affected_rows
FROM hsn_tax_master
WHERE tax_category = 'MEDICINE' AND effective_to = '2025-09-21';


-- ============================================================================
-- STEP 2: Insert New Medicine Tax Rates (5% - Effective Sep 22, 2025)
-- ============================================================================

-- Insert new 5% rates for all existing medicine HSN codes
INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, effective_to, tax_category, active, created_on, updated_on)
SELECT
    hsn_code,
    hsn_description,
    2.5 as cgst_rate,      -- Reduced from 6%
    2.5 as sgst_rate,      -- Reduced from 6%
    5.0 as igst_rate,      -- Reduced from 12%
    '2025-09-22' as effective_from,
    '2099-12-31' as effective_to,
    tax_category,
    true as active,
    CURRENT_TIMESTAMP as created_on,
    CURRENT_TIMESTAMP as updated_on
FROM hsn_tax_master
WHERE
    tax_category = 'MEDICINE'
    AND effective_to = '2025-09-21'
    AND (cgst_rate = 6 AND sgst_rate = 6 AND igst_rate = 12);

-- Verify new rates
SELECT
    'Created 5% Medicine Rates' as action,
    COUNT(*) as affected_rows
FROM hsn_tax_master
WHERE tax_category = 'MEDICINE'
    AND effective_from = '2025-09-22'
    AND cgst_rate = 2.5;


-- ============================================================================
-- STEP 3: Add 36 Critical Life-Saving Drugs at 0% GST
-- ============================================================================

-- NOTE: The following is a TEMPLATE. The actual list of 36 critical drugs
-- must be obtained from the official GST notification.
-- Update this section with actual HSN codes and drug names.

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, effective_to, tax_category, active, created_on, updated_on)
VALUES
    -- Example entries - REPLACE WITH ACTUAL CRITICAL DRUG HSN CODES
    -- Cancer Drugs (Example)
    -- ('30043100', 'Insulin and its salts', 0, 0, 0, '2025-09-22', '2099-12-31', 'MEDICINE_CRITICAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    -- ('30049011', 'Life-saving drug for cancer', 0, 0, 0, '2025-09-22', '2099-12-31', 'MEDICINE_CRITICAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

    -- TODO: Add all 36 critical drugs here
    -- Format: ('HSN_CODE', 'Description', 0, 0, 0, '2025-09-22', '2099-12-31', 'MEDICINE_CRITICAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

    -- Placeholder to prevent syntax error
    ('99999999', 'PLACEHOLDER - Remove after adding actual critical drugs', 0, 0, 0,
     '2025-09-22', '2099-12-31', 'MEDICINE_CRITICAL', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Verify critical drug rates
SELECT
    'Created 0% Critical Drug Rates' as action,
    COUNT(*) as affected_rows
FROM hsn_tax_master
WHERE tax_category = 'MEDICINE_CRITICAL'
    AND effective_from = '2025-09-22'
    AND cgst_rate = 0;


-- ============================================================================
-- STEP 4: Verification Report
-- ============================================================================

-- Show current effective rates by category
SELECT
    tax_category,
    cgst_rate,
    sgst_rate,
    igst_rate,
    cgst_rate + sgst_rate as total_gst,
    COUNT(*) as hsn_code_count,
    effective_from,
    effective_to
FROM hsn_tax_master
WHERE active = true
    AND effective_to >= CURRENT_DATE
GROUP BY tax_category, cgst_rate, sgst_rate, igst_rate, effective_from, effective_to
ORDER BY tax_category, total_gst;

-- Show medicine rates over time (for audit trail)
SELECT
    hsn_code,
    hsn_description,
    cgst_rate + sgst_rate as total_gst,
    effective_from,
    effective_to,
    CASE
        WHEN effective_to >= CURRENT_DATE THEN 'ACTIVE'
        ELSE 'HISTORICAL'
    END as status
FROM hsn_tax_master
WHERE tax_category IN ('MEDICINE', 'MEDICINE_CRITICAL')
ORDER BY hsn_code, effective_from;


-- ============================================================================
-- STEP 5: Test Tax Calculation Functions
-- ============================================================================

-- Test: Get current tax rate for a medicine HSN code
SELECT
    'Test: Medicine Tax Rate (Current Date)' as test_name,
    *
FROM get_hsn_tax_rate('30049011', CURRENT_DATE);

-- Test: Get historical tax rate (before Sep 22, 2025)
SELECT
    'Test: Medicine Tax Rate (Before Change - Sep 20, 2025)' as test_name,
    *
FROM get_hsn_tax_rate('30049011', '2025-09-20');

-- Test: Get new tax rate (after Sep 22, 2025)
SELECT
    'Test: Medicine Tax Rate (After Change - Sep 23, 2025)' as test_name,
    *
FROM get_hsn_tax_rate('30049011', '2025-09-23');


-- ============================================================================
-- STEP 6: Create Indexes for Performance (if not exists)
-- ============================================================================

-- Index for date-range queries (already created in migration 007, but ensure it exists)
CREATE INDEX IF NOT EXISTS idx_hsn_tax_effective_dates
ON hsn_tax_master(effective_from, effective_to)
WHERE active = true;

-- Index for category-based queries
CREATE INDEX IF NOT EXISTS idx_hsn_tax_category
ON hsn_tax_master(tax_category, effective_from, effective_to)
WHERE active = true;


-- ============================================================================
-- Comments & Documentation
-- ============================================================================

COMMENT ON TABLE hsn_tax_master IS
'GST rates by HSN code. Updated Sep 2025 for GST 2.0: Most medicines 5%, Critical drugs 0%';

COMMENT ON COLUMN hsn_tax_master.tax_category IS
'Categories: MEDICINE (5%), MEDICINE_CRITICAL (0%), SURGICAL (12%), COSMETIC (18%), etc.';

COMMIT;

-- ============================================================================
-- Post-Migration Checklist
-- ============================================================================

-- [ ] Verify old invoices (before Sep 22) use 12% rate
-- [ ] Verify new invoices (after Sep 22) use 5% rate
-- [ ] Update product master with correct HSN codes
-- [ ] Test invoice creation with new tax rates
-- [ ] Verify CGST/SGST calculation on frontend
-- [ ] Update invoice print templates to show HSN codes
-- [ ] Train users on new tax rates
-- [ ] File GSTR-1 with updated HSN codes

-- ============================================================================
-- Rollback Script (Emergency Use Only)
-- ============================================================================

-- UNCOMMENT BELOW ONLY IF ROLLBACK IS NEEDED
-- This will restore 12% medicine rates

/*
BEGIN;

-- Delete new 5% rates
DELETE FROM hsn_tax_master
WHERE tax_category = 'MEDICINE'
    AND effective_from = '2025-09-22'
    AND cgst_rate = 2.5;

-- Delete 0% critical drug rates
DELETE FROM hsn_tax_master
WHERE tax_category = 'MEDICINE_CRITICAL'
    AND effective_from = '2025-09-22'
    AND cgst_rate = 0;

-- Reopen old 12% rates
UPDATE hsn_tax_master
SET
    effective_to = '2099-12-31',
    updated_on = CURRENT_TIMESTAMP
WHERE
    tax_category = 'MEDICINE'
    AND effective_to = '2025-09-21'
    AND cgst_rate = 6;

COMMIT;
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

SELECT 'Migration 012 completed successfully!' as status;
SELECT 'IMPORTANT: Remember to obtain official list of 36 critical drugs and update STEP 3' as reminder;
