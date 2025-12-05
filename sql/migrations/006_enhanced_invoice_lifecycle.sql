-- ============================================================================
-- Migration: Enhanced Purchase Invoice Lifecycle Management
-- Version: 006
-- Date: 2025-12-05
-- Description:
--   - Add document type (Invoice/Delivery Challan) support
--   - Add item types (Regular/Return/Supplied)
--   - Add payment status tracking
--   - Add tax credit reconciliation
--   - Add purchase effectiveness tracking
--   - Add OCR document integration
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: BACKUP EXISTING DATA
-- ============================================================================

-- Create backup tables (for safety during migration)
CREATE TABLE IF NOT EXISTS purchase_invoice_backup_v006 AS
    SELECT * FROM purchase_invoice;

CREATE TABLE IF NOT EXISTS purchase_invoice_item_backup_v006 AS
    SELECT * FROM purchase_invoice_item;

CREATE TABLE IF NOT EXISTS vendor_payment_backup_v006 AS
    SELECT * FROM vendor_payment;

-- ============================================================================
-- SECTION 2: ENHANCE PURCHASE_INVOICE TABLE
-- ============================================================================

-- Add lifecycle management columns
ALTER TABLE purchase_invoice
ADD COLUMN IF NOT EXISTS doc_type VARCHAR(20) DEFAULT 'INVOICE',
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'UNPAID',
ADD COLUMN IF NOT EXISTS tax_status VARCHAR(20) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(20) DEFAULT 'OPEN';

-- Add payment tracking columns
ALTER TABLE purchase_invoice
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;

-- Add tax tracking columns
ALTER TABLE purchase_invoice
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS total_tax_credit NUMERIC(12,2);

-- Add tax reconciliation tracking
ALTER TABLE purchase_invoice
ADD COLUMN IF NOT EXISTS tax_filing_month DATE,
ADD COLUMN IF NOT EXISTS tax_reconciled_on TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tax_reconciled_by INT4;

-- Add invoice closure tracking
ALTER TABLE purchase_invoice
ADD COLUMN IF NOT EXISTS closed_on TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_by INT4,
ADD COLUMN IF NOT EXISTS closure_notes TEXT;

-- Add column comments for documentation
COMMENT ON COLUMN purchase_invoice.doc_type IS 'Document type: INVOICE or DELIVERY_CHALLAN';
COMMENT ON COLUMN purchase_invoice.payment_status IS 'Payment status: UNPAID, PARTIAL, PAID';
COMMENT ON COLUMN purchase_invoice.tax_status IS 'Tax reconciliation status: PENDING, FILED, CREDITED, RECONCILED';
COMMENT ON COLUMN purchase_invoice.lifecycle_status IS 'Invoice lifecycle: OPEN, CLOSED';
COMMENT ON COLUMN purchase_invoice.status IS 'Processing status: NEW, VERIFIED, COMPLETE';

-- ============================================================================
-- SECTION 3: UPDATE EXISTING INVOICE DATA
-- ============================================================================

-- Calculate and set payment_status based on existing vendor_payment records
UPDATE purchase_invoice pi
SET
  payment_status = CASE
    WHEN EXISTS (
      SELECT 1 FROM vendor_payment vp
      WHERE vp.invoice_id = pi.id
      GROUP BY vp.invoice_id
      HAVING SUM(vp.amount) >= pi.total
    ) THEN 'PAID'
    WHEN EXISTS (
      SELECT 1 FROM vendor_payment vp
      WHERE vp.invoice_id = pi.id
    ) THEN 'PARTIAL'
    ELSE 'UNPAID'
  END,
  paid_amount = COALESCE(
    (SELECT SUM(amount) FROM vendor_payment WHERE invoice_id = pi.id),
    0
  )
WHERE paid_amount IS NULL OR paid_amount = 0;

-- ============================================================================
-- SECTION 4: ENHANCE PURCHASE_INVOICE_ITEM TABLE
-- ============================================================================

-- Add item type management
ALTER TABLE purchase_invoice_item
ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'REGULAR',
ADD COLUMN IF NOT EXISTS challan_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS return_reason VARCHAR(255);

-- Add detailed tax breakdown
ALTER TABLE purchase_invoice_item
ADD COLUMN IF NOT EXISTS cgst_pcnt NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS sgst_pcnt NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS igst_pcnt NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2);

-- Add column comments
COMMENT ON COLUMN purchase_invoice_item.item_type IS 'Item type: REGULAR (normal purchase), RETURN (returning to vendor), SUPPLIED (from delivery challan)';
COMMENT ON COLUMN purchase_invoice_item.challan_ref IS 'Delivery challan reference number (for SUPPLIED items)';
COMMENT ON COLUMN purchase_invoice_item.return_reason IS 'Reason for return (for RETURN items)';

-- ============================================================================
-- SECTION 5: UPDATE EXISTING INVOICE ITEM DATA
-- ============================================================================

-- Calculate tax breakdown for existing items (assuming equal CGST/SGST split)
UPDATE purchase_invoice_item
SET
  cgst_pcnt = tax_pcnt / 2,
  sgst_pcnt = tax_pcnt / 2,
  cgst_amount = ROUND((ptr_value * qty * (tax_pcnt / 100)) / 2, 2),
  sgst_amount = ROUND((ptr_value * qty * (tax_pcnt / 100)) / 2, 2),
  igst_pcnt = 0,
  igst_amount = 0
WHERE tax_pcnt IS NOT NULL AND tax_pcnt > 0 AND cgst_pcnt IS NULL;

-- ============================================================================
-- SECTION 6: ENHANCE VENDOR_PAYMENT TABLE
-- ============================================================================

-- Add enhanced payment tracking
ALTER TABLE vendor_payment
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'FULL',
ADD COLUMN IF NOT EXISTS payment_against VARCHAR(20) DEFAULT 'INVOICE',
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'COMPLETED';

-- Add payment details
ALTER TABLE vendor_payment
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS cheque_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS utr_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_proof_doc_id INT4;

-- Add reconciliation tracking
ALTER TABLE vendor_payment
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reconciled_on TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reconciled_by INT4,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add column comments
COMMENT ON COLUMN vendor_payment.payment_type IS 'Payment type: ADVANCE, PARTIAL, FULL';
COMMENT ON COLUMN vendor_payment.payment_against IS 'Payment against: INVOICE, DELIVERY_CHALLAN';
COMMENT ON COLUMN vendor_payment.payment_status IS 'Payment status: PENDING, COMPLETED, FAILED';

-- ============================================================================
-- SECTION 7: CREATE NEW TABLE - TAX CREDIT RECONCILIATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_invoice_tax_credit (
    id SERIAL PRIMARY KEY,
    invoice_id INT4 NOT NULL,

    -- GST Filing Details
    gst_filing_month DATE NOT NULL,
    vendor_gstin VARCHAR(15) NOT NULL,

    -- Tax Amounts
    taxable_amount NUMERIC(12,2) NOT NULL,
    cgst_amount NUMERIC(12,2),
    sgst_amount NUMERIC(12,2),
    igst_amount NUMERIC(12,2),
    total_tax_credit NUMERIC(12,2) NOT NULL,

    -- Filing Status Tracking
    filing_status VARCHAR(20) DEFAULT 'PENDING',
    filed_date DATE,
    reflected_in_2a_date DATE,
    claimed_in_return VARCHAR(20),
    claimed_date DATE,

    -- Mismatch Handling
    has_mismatch BOOLEAN DEFAULT FALSE,
    mismatch_reason VARCHAR(255),
    mismatch_amount NUMERIC(12,2),
    mismatch_resolved BOOLEAN DEFAULT FALSE,
    mismatch_resolution_notes TEXT,

    -- Supporting Documents
    gstr1_doc_id INT4,
    gstr2a_screenshot_id INT4,

    -- Verification
    verified_by INT4,
    verified_on TIMESTAMPTZ,
    notes TEXT,

    -- Audit Fields
    active BOOLEAN DEFAULT TRUE NOT NULL,
    archive BOOLEAN DEFAULT FALSE NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Foreign Keys
    CONSTRAINT tax_credit_invoice_fk
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoice(id) ON DELETE CASCADE,
    CONSTRAINT tax_credit_gstr1_doc_fk
        FOREIGN KEY (gstr1_doc_id) REFERENCES documents(id) ON DELETE SET NULL,
    CONSTRAINT tax_credit_gstr2a_doc_fk
        FOREIGN KEY (gstr2a_screenshot_id) REFERENCES documents(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT chk_filing_status CHECK (filing_status IN ('PENDING', 'FILED_BY_VENDOR', 'REFLECTED_IN_2A', 'CLAIMED'))
);

-- Add table comment
COMMENT ON TABLE purchase_invoice_tax_credit IS 'Tracks GST tax credit reconciliation for purchase invoices';

-- ============================================================================
-- SECTION 8: CREATE NEW TABLE - PURCHASE EFFECTIVENESS
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_effectiveness (
    id SERIAL PRIMARY KEY,
    invoice_id INT4 NOT NULL,
    invoice_item_id INT4 NOT NULL,
    product_id INT4 NOT NULL,
    batch VARCHAR(50),

    -- Purchase Details
    purchased_qty INT4 NOT NULL,
    free_qty INT4 DEFAULT 0,
    total_received_qty INT4 NOT NULL,

    -- Disposition Tracking
    sold_qty INT4 DEFAULT 0,
    expired_qty INT4 DEFAULT 0,
    returned_to_vendor_qty INT4 DEFAULT 0,
    returned_by_customer_qty INT4 DEFAULT 0,
    lost_damaged_qty INT4 DEFAULT 0,
    adjusted_qty INT4 DEFAULT 0,
    current_stock_qty INT4 DEFAULT 0,

    -- Financial Impact
    purchase_value NUMERIC(12,2) NOT NULL,
    sold_value NUMERIC(12,2) DEFAULT 0,
    expired_value NUMERIC(12,2) DEFAULT 0,
    returned_value NUMERIC(12,2) DEFAULT 0,
    lost_value NUMERIC(12,2) DEFAULT 0,

    -- Effectiveness Metrics
    sellthrough_pcnt NUMERIC(5,2),
    wastage_pcnt NUMERIC(5,2),
    return_pcnt NUMERIC(5,2),
    profit_amount NUMERIC(12,2),
    roi_pcnt NUMERIC(5,2),

    -- Timeline
    first_sale_date DATE,
    last_sale_date DATE,
    days_to_first_sale INT4,
    days_to_sellout INT4,

    -- Status
    disposition_status VARCHAR(20),

    -- Calculation Tracking
    last_calculated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Audit Fields
    active BOOLEAN DEFAULT TRUE NOT NULL,
    archive BOOLEAN DEFAULT FALSE NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Foreign Keys
    CONSTRAINT eff_invoice_fk
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoice(id) ON DELETE CASCADE,
    CONSTRAINT eff_item_fk
        FOREIGN KEY (invoice_item_id) REFERENCES purchase_invoice_item(id) ON DELETE CASCADE,
    CONSTRAINT eff_product_fk
        FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT chk_disposition_status CHECK (disposition_status IN ('ACTIVE', 'SOLD_OUT', 'EXPIRED', 'CLEARED')),
    UNIQUE(invoice_item_id, batch)
);

-- Add table comment
COMMENT ON TABLE purchase_effectiveness IS 'Tracks purchase effectiveness metrics - ROI, sellthrough, wastage, etc.';

-- ============================================================================
-- SECTION 9: CREATE NEW TABLE - INVOICE DOCUMENT UPLOADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_invoice_document (
    id SERIAL PRIMARY KEY,
    invoice_id INT4,
    document_id INT4 NOT NULL,

    -- Document Classification
    doc_type VARCHAR(50) NOT NULL,

    -- OCR Processing
    ocr_status VARCHAR(20) DEFAULT 'PENDING',
    ocr_processed_on TIMESTAMPTZ,
    ocr_confidence_score NUMERIC(5,2),
    ocr_extracted_data JSONB,
    ocr_error_message TEXT,

    -- Auto-population
    auto_populated BOOLEAN DEFAULT FALSE,
    auto_populate_status VARCHAR(20),
    field_mapping JSONB,

    -- Manual Review
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by INT4,
    reviewed_on TIMESTAMPTZ,
    review_notes TEXT,

    -- Upload Metadata
    upload_source VARCHAR(50),
    original_filename VARCHAR(255),

    -- Audit Fields
    active BOOLEAN DEFAULT TRUE NOT NULL,
    archive BOOLEAN DEFAULT FALSE NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4,
    updated_by INT4,

    -- Foreign Keys
    CONSTRAINT inv_doc_invoice_fk
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoice(id) ON DELETE CASCADE,
    CONSTRAINT inv_doc_document_fk
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT chk_doc_type CHECK (doc_type IN ('INVOICE_SCAN', 'DELIVERY_CHALLAN_SCAN', 'PAYMENT_PROOF', 'GSTR1', 'GSTR2A', 'OTHER')),
    CONSTRAINT chk_ocr_status CHECK (ocr_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT chk_auto_populate_status CHECK (auto_populate_status IN ('NOT_ATTEMPTED', 'PARTIAL', 'COMPLETE', 'FAILED'))
);

-- Add table comment
COMMENT ON TABLE purchase_invoice_document IS 'Manages invoice document uploads and OCR processing';

-- ============================================================================
-- SECTION 10: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes on purchase_invoice
CREATE INDEX IF NOT EXISTS idx_invoice_doc_type ON purchase_invoice(doc_type);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_status ON purchase_invoice(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoice_tax_status ON purchase_invoice(tax_status);
CREATE INDEX IF NOT EXISTS idx_invoice_lifecycle_status ON purchase_invoice(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_invoice_tax_filing_month ON purchase_invoice(tax_filing_month);

-- Indexes on purchase_invoice_item
CREATE INDEX IF NOT EXISTS idx_item_type ON purchase_invoice_item(item_type);
CREATE INDEX IF NOT EXISTS idx_item_challan_ref ON purchase_invoice_item(challan_ref);

-- Indexes on vendor_payment
CREATE INDEX IF NOT EXISTS idx_payment_type ON vendor_payment(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_status ON vendor_payment(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_reconciled ON vendor_payment(reconciled);

-- Indexes on purchase_invoice_tax_credit
CREATE INDEX IF NOT EXISTS idx_tax_credit_invoice ON purchase_invoice_tax_credit(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tax_credit_filing_month ON purchase_invoice_tax_credit(gst_filing_month);
CREATE INDEX IF NOT EXISTS idx_tax_credit_status ON purchase_invoice_tax_credit(filing_status);
CREATE INDEX IF NOT EXISTS idx_tax_credit_vendor_gstin ON purchase_invoice_tax_credit(vendor_gstin);
CREATE INDEX IF NOT EXISTS idx_tax_credit_has_mismatch ON purchase_invoice_tax_credit(has_mismatch) WHERE has_mismatch = TRUE;

-- Indexes on purchase_effectiveness
CREATE INDEX IF NOT EXISTS idx_eff_invoice ON purchase_effectiveness(invoice_id);
CREATE INDEX IF NOT EXISTS idx_eff_item ON purchase_effectiveness(invoice_item_id);
CREATE INDEX IF NOT EXISTS idx_eff_product ON purchase_effectiveness(product_id);
CREATE INDEX IF NOT EXISTS idx_eff_status ON purchase_effectiveness(disposition_status);
CREATE INDEX IF NOT EXISTS idx_eff_batch ON purchase_effectiveness(batch);
CREATE INDEX IF NOT EXISTS idx_eff_last_calculated ON purchase_effectiveness(last_calculated_on);

-- Indexes on purchase_invoice_document
CREATE INDEX IF NOT EXISTS idx_inv_doc_invoice ON purchase_invoice_document(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_doc_document ON purchase_invoice_document(document_id);
CREATE INDEX IF NOT EXISTS idx_inv_doc_type ON purchase_invoice_document(doc_type);
CREATE INDEX IF NOT EXISTS idx_inv_doc_ocr_status ON purchase_invoice_document(ocr_status);
CREATE INDEX IF NOT EXISTS idx_inv_doc_requires_review ON purchase_invoice_document(requires_review) WHERE requires_review = TRUE;

-- ============================================================================
-- SECTION 11: ADD CONSTRAINTS
-- ============================================================================

-- Add check constraints to purchase_invoice
ALTER TABLE purchase_invoice
ADD CONSTRAINT IF NOT EXISTS chk_doc_type
    CHECK (doc_type IN ('INVOICE', 'DELIVERY_CHALLAN'));

ALTER TABLE purchase_invoice
ADD CONSTRAINT IF NOT EXISTS chk_payment_status
    CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID'));

ALTER TABLE purchase_invoice
ADD CONSTRAINT IF NOT EXISTS chk_tax_status
    CHECK (tax_status IN ('PENDING', 'FILED', 'CREDITED', 'RECONCILED'));

ALTER TABLE purchase_invoice
ADD CONSTRAINT IF NOT EXISTS chk_lifecycle_status
    CHECK (lifecycle_status IN ('OPEN', 'CLOSED'));

-- Add check constraints to purchase_invoice_item
ALTER TABLE purchase_invoice_item
ADD CONSTRAINT IF NOT EXISTS chk_item_type
    CHECK (item_type IN ('REGULAR', 'RETURN', 'SUPPLIED'));

-- Add check constraints to vendor_payment
ALTER TABLE vendor_payment
ADD CONSTRAINT IF NOT EXISTS chk_payment_type
    CHECK (payment_type IN ('ADVANCE', 'PARTIAL', 'FULL'));

ALTER TABLE vendor_payment
ADD CONSTRAINT IF NOT EXISTS chk_payment_against
    CHECK (payment_against IN ('INVOICE', 'DELIVERY_CHALLAN'));

ALTER TABLE vendor_payment
ADD CONSTRAINT IF NOT EXISTS chk_vp_payment_status
    CHECK (payment_status IN ('PENDING', 'COMPLETED', 'FAILED'));

-- Add foreign key from vendor_payment to documents (for payment proof)
ALTER TABLE vendor_payment
ADD CONSTRAINT IF NOT EXISTS payment_proof_doc_fk
    FOREIGN KEY (payment_proof_doc_id) REFERENCES documents(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 12: CREATE TRIGGER FOR UPDATED_ON TIMESTAMP
-- ============================================================================

-- Function to update updated_on timestamp
CREATE OR REPLACE FUNCTION update_updated_on_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for new tables
DROP TRIGGER IF EXISTS update_tax_credit_updated_on ON purchase_invoice_tax_credit;
CREATE TRIGGER update_tax_credit_updated_on
    BEFORE UPDATE ON purchase_invoice_tax_credit
    FOR EACH ROW EXECUTE FUNCTION update_updated_on_column();

DROP TRIGGER IF EXISTS update_effectiveness_updated_on ON purchase_effectiveness;
CREATE TRIGGER update_effectiveness_updated_on
    BEFORE UPDATE ON purchase_effectiveness
    FOR EACH ROW EXECUTE FUNCTION update_updated_on_column();

DROP TRIGGER IF EXISTS update_inv_doc_updated_on ON purchase_invoice_document;
CREATE TRIGGER update_inv_doc_updated_on
    BEFORE UPDATE ON purchase_invoice_document
    FOR EACH ROW EXECUTE FUNCTION update_updated_on_column();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify new columns were added
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'purchase_invoice'
    AND column_name IN ('doc_type', 'payment_status', 'tax_status', 'lifecycle_status');

    IF v_count = 4 THEN
        RAISE NOTICE 'SUCCESS: All new columns added to purchase_invoice';
    ELSE
        RAISE WARNING 'WARNING: Expected 4 new columns in purchase_invoice, found %', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_name IN ('purchase_invoice_tax_credit', 'purchase_effectiveness', 'purchase_invoice_document');

    IF v_count = 3 THEN
        RAISE NOTICE 'SUCCESS: All new tables created';
    ELSE
        RAISE WARNING 'WARNING: Expected 3 new tables, found %', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Migration completed successfully
-- Next steps:
-- 1. Update TypeORM entities to match new schema
-- 2. Update DTOs for new fields
-- 3. Update service layer with validation logic
-- 4. Update frontend components
-- ============================================================================
