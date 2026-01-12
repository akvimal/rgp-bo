-- Migration 014: Add ITC Tracking Fields to Purchase Invoice
-- Purpose: Enable ITC reconciliation and tracking for GST compliance
-- Author: System
-- Date: 2025-12-06

BEGIN;

-- ============================================================================
-- STEP 1: Add ITC Tracking Fields to purchase_invoice
-- ============================================================================

ALTER TABLE purchase_invoice
ADD COLUMN IF NOT EXISTS tax_status VARCHAR(20) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS itc_claim_date DATE,
ADD COLUMN IF NOT EXISTS itc_ineligible_reason VARCHAR(200),
ADD COLUMN IF NOT EXISTS gstr2b_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gstr2b_verified_date DATE,
ADD COLUMN IF NOT EXISTS payment_made_date DATE,
ADD COLUMN IF NOT EXISTS payment_due_date DATE,
ADD COLUMN IF NOT EXISTS itc_reversed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS itc_reversal_date DATE,
ADD COLUMN IF NOT EXISTS itc_reversal_reason VARCHAR(200);

-- Add comments
COMMENT ON COLUMN purchase_invoice.tax_status IS
'ITC Status: PENDING, ITC_ELIGIBLE, ITC_INELIGIBLE, ITC_CLAIMED, ITC_REVERSED';

COMMENT ON COLUMN purchase_invoice.itc_claim_date IS
'Date when ITC was claimed in GSTR-3B';

COMMENT ON COLUMN purchase_invoice.itc_ineligible_reason IS
'Reason why ITC cannot be claimed (e.g., Not in GSTR-2B, No GSTIN, etc.)';

COMMENT ON COLUMN purchase_invoice.gstr2b_verified IS
'Whether invoice verified in GSTR-2B';

COMMENT ON COLUMN purchase_invoice.gstr2b_verified_date IS
'Date when verified against GSTR-2B';

COMMENT ON COLUMN purchase_invoice.payment_made_date IS
'Date when payment was made to vendor';

COMMENT ON COLUMN purchase_invoice.payment_due_date IS
'Date by which payment must be made (invoice_date + 180 days for ITC)';

COMMENT ON COLUMN purchase_invoice.itc_reversed IS
'Whether ITC was reversed (e.g., payment not made in 180 days)';

COMMENT ON COLUMN purchase_invoice.itc_reversal_date IS
'Date when ITC was reversed';

COMMENT ON COLUMN purchase_invoice.itc_reversal_reason IS
'Reason for ITC reversal';

-- ============================================================================
-- STEP 2: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_tax_status
ON purchase_invoice(tax_status, invoice_date);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_gstr2b
ON purchase_invoice(gstr2b_verified, invoice_date);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payment_date
ON purchase_invoice(payment_made_date, invoice_date);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_itc_claim
ON purchase_invoice(itc_claim_date)
WHERE itc_claim_date IS NOT NULL;

-- ============================================================================
-- STEP 3: Update Existing Records
-- ============================================================================

-- Set payment_due_date for existing invoices (invoice_date + 180 days)
UPDATE purchase_invoice
SET payment_due_date = invoice_date + INTERVAL '180 days'
WHERE payment_due_date IS NULL;

-- Mark paid invoices
UPDATE purchase_invoice
SET payment_made_date = updated_on,
    tax_status = CASE
        WHEN payment_status = 'PAID' THEN 'ITC_ELIGIBLE'
        ELSE 'PENDING'
    END
WHERE payment_status = 'PAID' AND payment_made_date IS NULL;

-- ============================================================================
-- STEP 4: Create Trigger to Auto-set Payment Due Date
-- ============================================================================

CREATE OR REPLACE FUNCTION set_payment_due_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Set payment due date to invoice_date + 180 days
    IF NEW.payment_due_date IS NULL AND NEW.invoice_date IS NOT NULL THEN
        NEW.payment_due_date := NEW.invoice_date + INTERVAL '180 days';
    END IF;

    -- Auto-set payment_made_date when payment_status changes to PAID
    IF NEW.payment_status = 'PAID' AND OLD.payment_status != 'PAID' THEN
        NEW.payment_made_date := CURRENT_DATE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_payment_due_date
    BEFORE INSERT OR UPDATE ON purchase_invoice
    FOR EACH ROW
    EXECUTE FUNCTION set_payment_due_date();

-- ============================================================================
-- STEP 5: Create View for ITC Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW v_itc_dashboard AS
SELECT
    -- Time period
    DATE_TRUNC('month', pi.invoice_date) as invoice_month,

    -- Invoice counts
    COUNT(DISTINCT pi.id) as total_invoices,
    COUNT(DISTINCT CASE WHEN pi.tax_status = 'ITC_ELIGIBLE' THEN pi.id END) as itc_eligible_count,
    COUNT(DISTINCT CASE WHEN pi.tax_status = 'ITC_CLAIMED' THEN pi.id END) as itc_claimed_count,
    COUNT(DISTINCT CASE WHEN pi.tax_status = 'ITC_INELIGIBLE' THEN pi.id END) as itc_ineligible_count,
    COUNT(DISTINCT CASE WHEN pi.tax_status = 'PENDING' THEN pi.id END) as pending_count,
    COUNT(DISTINCT CASE WHEN pi.gstr2b_verified THEN pi.id END) as gstr2b_verified_count,

    -- Tax amounts
    SUM(pi.cgst_amount) as total_cgst,
    SUM(pi.sgst_amount) as total_sgst,
    SUM(pi.igst_amount) as total_igst,
    SUM(pi.cgst_amount + pi.sgst_amount + pi.igst_amount) as total_tax,

    -- ITC amounts
    SUM(CASE WHEN pi.tax_status = 'ITC_ELIGIBLE' THEN pi.cgst_amount ELSE 0 END) as eligible_cgst,
    SUM(CASE WHEN pi.tax_status = 'ITC_ELIGIBLE' THEN pi.sgst_amount ELSE 0 END) as eligible_sgst,
    SUM(CASE WHEN pi.tax_status = 'ITC_ELIGIBLE' THEN pi.igst_amount ELSE 0 END) as eligible_igst,
    SUM(CASE WHEN pi.tax_status = 'ITC_ELIGIBLE'
        THEN pi.cgst_amount + pi.sgst_amount + pi.igst_amount ELSE 0 END) as eligible_itc,

    SUM(CASE WHEN pi.tax_status = 'ITC_CLAIMED' THEN pi.cgst_amount ELSE 0 END) as claimed_cgst,
    SUM(CASE WHEN pi.tax_status = 'ITC_CLAIMED' THEN pi.sgst_amount ELSE 0 END) as claimed_sgst,
    SUM(CASE WHEN pi.tax_status = 'ITC_CLAIMED' THEN pi.igst_amount ELSE 0 END) as claimed_igst,
    SUM(CASE WHEN pi.tax_status = 'ITC_CLAIMED'
        THEN pi.cgst_amount + pi.sgst_amount + pi.igst_amount ELSE 0 END) as claimed_itc,

    -- Payment tracking
    COUNT(DISTINCT CASE WHEN pi.payment_made_date IS NOT NULL THEN pi.id END) as paid_count,
    COUNT(DISTINCT CASE WHEN pi.payment_due_date < CURRENT_DATE
        AND pi.payment_made_date IS NULL THEN pi.id END) as overdue_count

FROM purchase_invoice pi
WHERE pi.active = true
  AND pi.archive = false
  AND pi.status NOT IN ('CANCELLED', 'DRAFT')
GROUP BY DATE_TRUNC('month', pi.invoice_date)
ORDER BY invoice_month DESC;

COMMENT ON VIEW v_itc_dashboard IS
'Monthly ITC summary dashboard showing eligible, claimed, and ineligible ITC amounts';

-- ============================================================================
-- STEP 6: Create View for Overdue Payments (ITC Risk)
-- ============================================================================

CREATE OR REPLACE VIEW v_itc_payment_risk AS
SELECT
    pi.id,
    pi.invoice_no,
    pi.invoice_date,
    pi.payment_due_date,
    v.gstn as vendor_gstin,
    v.business_name as vendor_name,
    pi.total as invoice_value,
    pi.cgst_amount,
    pi.sgst_amount,
    pi.igst_amount,
    (pi.cgst_amount + pi.sgst_amount + pi.igst_amount) as total_itc_at_risk,
    pi.payment_status,
    pi.tax_status,
    (pi.payment_due_date - CURRENT_DATE) as days_remaining,
    CASE
        WHEN CURRENT_DATE > pi.payment_due_date THEN 'OVERDUE - ITC REVERSAL REQUIRED'
        WHEN (pi.payment_due_date - CURRENT_DATE) <= 30 THEN 'CRITICAL - 30 DAYS LEFT'
        WHEN (pi.payment_due_date - CURRENT_DATE) <= 60 THEN 'WARNING - 60 DAYS LEFT'
        ELSE 'OK'
    END as risk_status
FROM purchase_invoice pi
INNER JOIN vendor v ON v.id = pi.vendor_id
WHERE pi.payment_made_date IS NULL
  AND pi.payment_status != 'PAID'
  AND pi.active = true
  AND pi.status NOT IN ('CANCELLED', 'DRAFT')
  AND (pi.payment_due_date - CURRENT_DATE) <= 60  -- Show if within 60 days of due date
ORDER BY pi.payment_due_date ASC;

COMMENT ON VIEW v_itc_payment_risk IS
'Invoices at risk of ITC reversal due to payment not made within 180 days';

-- ============================================================================
-- STEP 7: Verification Queries
-- ============================================================================

-- Check new columns added
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_invoice'
  AND column_name IN (
    'tax_status', 'itc_claim_date', 'gstr2b_verified',
    'payment_made_date', 'payment_due_date', 'itc_reversed'
  )
ORDER BY column_name;

-- Check indexes created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'purchase_invoice'
  AND indexname LIKE '%tax_status%' OR indexname LIKE '%gstr2b%'
  OR indexname LIKE '%payment%' OR indexname LIKE '%itc%';

-- Test views
SELECT * FROM v_itc_dashboard LIMIT 5;
SELECT * FROM v_itc_payment_risk LIMIT 5;

-- Summary
SELECT
    'Migration 014 completed successfully!' as status,
    COUNT(*) as total_invoices,
    COUNT(CASE WHEN payment_due_date IS NOT NULL THEN 1 END) as with_due_date,
    COUNT(CASE WHEN tax_status IS NOT NULL THEN 1 END) as with_tax_status
FROM purchase_invoice;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Emergency Use Only)
-- ============================================================================

-- UNCOMMENT BELOW ONLY IF ROLLBACK IS NEEDED
/*
BEGIN;

-- Drop views
DROP VIEW IF EXISTS v_itc_dashboard CASCADE;
DROP VIEW IF EXISTS v_itc_payment_risk CASCADE;

-- Drop trigger and function
DROP TRIGGER IF EXISTS trg_set_payment_due_date ON purchase_invoice;
DROP FUNCTION IF EXISTS set_payment_due_date();

-- Drop indexes
DROP INDEX IF EXISTS idx_purchase_invoice_tax_status;
DROP INDEX IF EXISTS idx_purchase_invoice_gstr2b;
DROP INDEX IF EXISTS idx_purchase_invoice_payment_date;
DROP INDEX IF EXISTS idx_purchase_invoice_itc_claim;

-- Remove columns
ALTER TABLE purchase_invoice
DROP COLUMN IF EXISTS tax_status,
DROP COLUMN IF EXISTS itc_claim_date,
DROP COLUMN IF EXISTS itc_ineligible_reason,
DROP COLUMN IF EXISTS gstr2b_verified,
DROP COLUMN IF EXISTS gstr2b_verified_date,
DROP COLUMN IF EXISTS payment_made_date,
DROP COLUMN IF EXISTS payment_due_date,
DROP COLUMN IF EXISTS itc_reversed,
DROP COLUMN IF EXISTS itc_reversal_date,
DROP COLUMN IF EXISTS itc_reversal_reason;

COMMIT;
*/

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Mark invoice as GSTR-2B verified and ITC eligible
-- UPDATE purchase_invoice
-- SET gstr2b_verified = true,
--     gstr2b_verified_date = CURRENT_DATE,
--     tax_status = 'ITC_ELIGIBLE'
-- WHERE id = XXX;

-- Mark invoice as ITC claimed
-- UPDATE purchase_invoice
-- SET tax_status = 'ITC_CLAIMED',
--     itc_claim_date = '2026-02-20'  -- GSTR-3B filing date
-- WHERE tax_status = 'ITC_ELIGIBLE'
--   AND invoice_date >= '2026-01-01'
--   AND invoice_date <= '2026-01-31';

-- Mark invoice as ITC ineligible
-- UPDATE purchase_invoice
-- SET tax_status = 'ITC_INELIGIBLE',
--     itc_ineligible_reason = 'Not found in GSTR-2B'
-- WHERE id = XXX;

-- Find invoices needing payment (to avoid ITC reversal)
-- SELECT * FROM v_itc_payment_risk
-- WHERE risk_status LIKE 'CRITICAL%' OR risk_status LIKE 'OVERDUE%';
