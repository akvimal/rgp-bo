-- ============================================================================
-- ROLLBACK: Enhanced Purchase Invoice Lifecycle Management
-- Version: 006
-- Date: 2025-12-05
-- Description: Rollback script for migration 006
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: DROP NEW TABLES
-- ============================================================================

DROP TABLE IF EXISTS purchase_invoice_document CASCADE;
DROP TABLE IF EXISTS purchase_effectiveness CASCADE;
DROP TABLE IF EXISTS purchase_invoice_tax_credit CASCADE;

-- ============================================================================
-- SECTION 2: DROP INDEXES
-- ============================================================================

-- Indexes on purchase_invoice
DROP INDEX IF EXISTS idx_invoice_doc_type;
DROP INDEX IF EXISTS idx_invoice_payment_status;
DROP INDEX IF EXISTS idx_invoice_tax_status;
DROP INDEX IF EXISTS idx_invoice_lifecycle_status;
DROP INDEX IF EXISTS idx_invoice_tax_filing_month;

-- Indexes on purchase_invoice_item
DROP INDEX IF EXISTS idx_item_type;
DROP INDEX IF EXISTS idx_item_challan_ref;

-- Indexes on vendor_payment
DROP INDEX IF EXISTS idx_payment_type;
DROP INDEX IF EXISTS idx_payment_status;
DROP INDEX IF EXISTS idx_payment_reconciled;

-- ============================================================================
-- SECTION 3: DROP CONSTRAINTS
-- ============================================================================

-- Drop constraints from purchase_invoice
ALTER TABLE purchase_invoice DROP CONSTRAINT IF EXISTS chk_doc_type;
ALTER TABLE purchase_invoice DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE purchase_invoice DROP CONSTRAINT IF EXISTS chk_tax_status;
ALTER TABLE purchase_invoice DROP CONSTRAINT IF EXISTS chk_lifecycle_status;

-- Drop constraints from purchase_invoice_item
ALTER TABLE purchase_invoice_item DROP CONSTRAINT IF EXISTS chk_item_type;

-- Drop constraints from vendor_payment
ALTER TABLE vendor_payment DROP CONSTRAINT IF EXISTS chk_payment_type;
ALTER TABLE vendor_payment DROP CONSTRAINT IF EXISTS chk_payment_against;
ALTER TABLE vendor_payment DROP CONSTRAINT IF EXISTS chk_vp_payment_status;
ALTER TABLE vendor_payment DROP CONSTRAINT IF EXISTS payment_proof_doc_fk;

-- ============================================================================
-- SECTION 4: DROP COLUMNS FROM VENDOR_PAYMENT
-- ============================================================================

ALTER TABLE vendor_payment
DROP COLUMN IF EXISTS payment_type,
DROP COLUMN IF EXISTS payment_against,
DROP COLUMN IF EXISTS payment_status,
DROP COLUMN IF EXISTS bank_name,
DROP COLUMN IF EXISTS cheque_no,
DROP COLUMN IF EXISTS utr_no,
DROP COLUMN IF EXISTS payment_proof_doc_id,
DROP COLUMN IF EXISTS reconciled,
DROP COLUMN IF EXISTS reconciled_on,
DROP COLUMN IF EXISTS reconciled_by,
DROP COLUMN IF EXISTS notes;

-- ============================================================================
-- SECTION 5: DROP COLUMNS FROM PURCHASE_INVOICE_ITEM
-- ============================================================================

ALTER TABLE purchase_invoice_item
DROP COLUMN IF EXISTS item_type,
DROP COLUMN IF EXISTS challan_ref,
DROP COLUMN IF EXISTS return_reason,
DROP COLUMN IF EXISTS cgst_pcnt,
DROP COLUMN IF EXISTS sgst_pcnt,
DROP COLUMN IF EXISTS igst_pcnt,
DROP COLUMN IF EXISTS cgst_amount,
DROP COLUMN IF EXISTS sgst_amount,
DROP COLUMN IF EXISTS igst_amount;

-- ============================================================================
-- SECTION 6: DROP COLUMNS FROM PURCHASE_INVOICE
-- ============================================================================

ALTER TABLE purchase_invoice
DROP COLUMN IF EXISTS doc_type,
DROP COLUMN IF EXISTS payment_status,
DROP COLUMN IF EXISTS tax_status,
DROP COLUMN IF EXISTS lifecycle_status,
DROP COLUMN IF EXISTS paid_amount,
DROP COLUMN IF EXISTS tax_amount,
DROP COLUMN IF EXISTS cgst_amount,
DROP COLUMN IF EXISTS sgst_amount,
DROP COLUMN IF EXISTS igst_amount,
DROP COLUMN IF EXISTS total_tax_credit,
DROP COLUMN IF EXISTS tax_filing_month,
DROP COLUMN IF EXISTS tax_reconciled_on,
DROP COLUMN IF EXISTS tax_reconciled_by,
DROP COLUMN IF EXISTS closed_on,
DROP COLUMN IF EXISTS closed_by,
DROP COLUMN IF EXISTS closure_notes;

-- ============================================================================
-- SECTION 7: RESTORE FROM BACKUP (OPTIONAL)
-- ============================================================================

-- Uncomment the following if you want to restore original data from backup

-- TRUNCATE TABLE purchase_invoice;
-- INSERT INTO purchase_invoice SELECT * FROM purchase_invoice_backup_v006;

-- TRUNCATE TABLE purchase_invoice_item;
-- INSERT INTO purchase_invoice_item SELECT * FROM purchase_invoice_item_backup_v006;

-- TRUNCATE TABLE vendor_payment;
-- INSERT INTO vendor_payment SELECT * FROM vendor_payment_backup_v006;

-- ============================================================================
-- SECTION 8: DROP BACKUP TABLES
-- ============================================================================

DROP TABLE IF EXISTS purchase_invoice_backup_v006;
DROP TABLE IF EXISTS purchase_invoice_item_backup_v006;
DROP TABLE IF EXISTS vendor_payment_backup_v006;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'purchase_invoice'
    AND column_name IN ('doc_type', 'payment_status', 'tax_status', 'lifecycle_status');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All new columns removed from purchase_invoice';
    ELSE
        RAISE WARNING 'WARNING: Found % columns that should have been removed', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_name IN ('purchase_invoice_tax_credit', 'purchase_effectiveness', 'purchase_invoice_document');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All new tables removed';
    ELSE
        RAISE WARNING 'WARNING: Found % tables that should have been removed', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================

-- Rollback completed
-- Schema restored to pre-migration state
-- ============================================================================
