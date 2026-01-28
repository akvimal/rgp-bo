-- =====================================================================
-- Migration 009: Product Batch Management System
-- =====================================================================
-- Purpose: Implement comprehensive batch/expiry tracking with FEFO
-- Issue: #127 - Implement Batch/Expiry Tracking with FEFO Enforcement
-- Created: 2026-01-17
-- =====================================================================

-- =====================================================================
-- 1. CREATE PRODUCT_BATCH TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS product_batch (
  id SERIAL PRIMARY KEY,

  -- Product reference
  product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE RESTRICT,

  -- Batch identification
  batch_number VARCHAR(50) NOT NULL,
  expiry_date DATE NOT NULL,
  manufactured_date DATE,

  -- Quantity tracking
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  quantity_remaining INTEGER NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),

  -- Purchase reference
  purchase_invoice_item_id INTEGER REFERENCES purchase_invoice_item(id),
  vendor_id INTEGER REFERENCES vendor(id),
  ptr_cost NUMERIC(10,2),

  -- Metadata
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPLETED', 'EXPIRED', 'RECALLED')),

  -- Audit columns
  created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES app_user(id),
  updated_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES app_user(id),
  active BOOLEAN DEFAULT true,
  archive BOOLEAN DEFAULT false,

  -- Constraints
  CONSTRAINT unique_product_batch_expiry UNIQUE (product_id, batch_number, expiry_date),
  CONSTRAINT valid_expiry_date CHECK (expiry_date > manufactured_date OR manufactured_date IS NULL),
  CONSTRAINT valid_quantity_remaining CHECK (quantity_remaining <= quantity_received)
);

-- Indexes for performance
CREATE INDEX idx_batch_product_expiry ON product_batch(product_id, expiry_date);
CREATE INDEX idx_batch_status_expiry ON product_batch(status, expiry_date);
CREATE INDEX idx_batch_product_status ON product_batch(product_id, status) WHERE active = true;
CREATE INDEX idx_batch_near_expiry ON product_batch(expiry_date) WHERE status = 'ACTIVE' AND active = true;

-- Comment on table
COMMENT ON TABLE product_batch IS 'Master table for product batch tracking with expiry dates and FEFO allocation';
COMMENT ON COLUMN product_batch.batch_number IS 'Manufacturer batch/lot number';
COMMENT ON COLUMN product_batch.quantity_received IS 'Total quantity received in this batch (immutable)';
COMMENT ON COLUMN product_batch.quantity_remaining IS 'Current available quantity in this batch';
COMMENT ON COLUMN product_batch.status IS 'ACTIVE: available for sale, DEPLETED: qty=0, EXPIRED: past expiry, RECALLED: vendor recall';

-- =====================================================================
-- 2. CREATE BATCH_MOVEMENT_LOG TABLE (IMMUTABLE AUDIT TRAIL)
-- =====================================================================

CREATE TABLE IF NOT EXISTS batch_movement_log (
  id SERIAL PRIMARY KEY,

  -- Batch reference
  batch_id INTEGER NOT NULL REFERENCES product_batch(id) ON DELETE RESTRICT,

  -- Movement details
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('RECEIVED', 'SOLD', 'ADJUSTED', 'RETURNED', 'EXPIRED', 'RECALLED')),
  quantity INTEGER NOT NULL,

  -- Reference to source transaction
  reference_type VARCHAR(50),  -- SALE, PURCHASE_INVOICE, STOCK_ADJUSTMENT, RETURN
  reference_id INTEGER,

  -- Audit trail (immutable)
  performed_by INTEGER REFERENCES app_user(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  notes TEXT,

  -- Ensure immutability - no updates or deletes allowed
  CONSTRAINT batch_movement_immutable CHECK (performed_at IS NOT NULL)
);

-- Indexes for audit queries
CREATE INDEX idx_batch_movement_batch ON batch_movement_log(batch_id, performed_at DESC);
CREATE INDEX idx_batch_movement_type ON batch_movement_log(movement_type, performed_at DESC);
CREATE INDEX idx_batch_movement_reference ON batch_movement_log(reference_type, reference_id);

-- Comment on table
COMMENT ON TABLE batch_movement_log IS 'Immutable audit log of all batch quantity movements';
COMMENT ON COLUMN batch_movement_log.movement_type IS 'Type of movement: RECEIVED (purchase), SOLD (sale), ADJUSTED (manual), RETURNED (customer return), EXPIRED (auto-marked), RECALLED (vendor recall)';

-- =====================================================================
-- 3. CREATE TRIGGER TO PREVENT UPDATES/DELETES ON BATCH_MOVEMENT_LOG
-- =====================================================================

-- Function to prevent modification
CREATE OR REPLACE FUNCTION prevent_batch_movement_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Batch movement log is immutable. Cannot UPDATE or DELETE records.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on UPDATE
CREATE TRIGGER prevent_batch_movement_update
  BEFORE UPDATE ON batch_movement_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_batch_movement_modification();

-- Trigger on DELETE
CREATE TRIGGER prevent_batch_movement_delete
  BEFORE DELETE ON batch_movement_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_batch_movement_modification();

-- =====================================================================
-- 4. CREATE HELPER FUNCTION FOR BATCH ALLOCATION (FEFO)
-- =====================================================================

CREATE OR REPLACE FUNCTION get_available_batches_fefo(
  p_product_id INTEGER,
  p_required_qty INTEGER
)
RETURNS TABLE (
  batch_id INTEGER,
  batch_number VARCHAR,
  expiry_date DATE,
  quantity_available INTEGER,
  quantity_to_allocate INTEGER
) AS $$
DECLARE
  v_remaining_qty INTEGER := p_required_qty;
  v_batch RECORD;
BEGIN
  -- Get batches ordered by expiry date (FEFO - First Expiry First Out)
  FOR v_batch IN
    SELECT
      pb.id,
      pb.batch_number,
      pb.expiry_date,
      pb.quantity_remaining
    FROM product_batch pb
    WHERE pb.product_id = p_product_id
      AND pb.status = 'ACTIVE'
      AND pb.expiry_date > CURRENT_DATE
      AND pb.quantity_remaining > 0
      AND pb.active = true
    ORDER BY pb.expiry_date ASC, pb.created_on ASC
    FOR UPDATE  -- Lock rows for allocation
  LOOP
    -- Calculate how much to allocate from this batch
    IF v_remaining_qty <= 0 THEN
      EXIT;  -- Already allocated enough
    END IF;

    RETURN QUERY SELECT
      v_batch.id,
      v_batch.batch_number,
      v_batch.expiry_date,
      v_batch.quantity_remaining,
      LEAST(v_batch.quantity_remaining, v_remaining_qty);

    v_remaining_qty := v_remaining_qty - LEAST(v_batch.quantity_remaining, v_remaining_qty);
  END LOOP;

  -- Check if we have enough stock
  IF v_remaining_qty > 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Required: %, Available: %',
      p_required_qty, (p_required_qty - v_remaining_qty);
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_batches_fefo IS 'Returns batches to allocate for a product using FEFO (First Expiry First Out) logic with row-level locking';

-- =====================================================================
-- 5. CREATE VIEW FOR BATCH INVENTORY SUMMARY
-- =====================================================================

CREATE OR REPLACE VIEW batch_inventory_view AS
SELECT
  pb.id AS batch_id,
  pb.product_id,
  p.title AS product_name,
  p.category,
  pb.batch_number,
  pb.expiry_date,
  pb.manufactured_date,
  pb.quantity_received,
  pb.quantity_remaining,
  pb.status,
  pb.received_date,

  -- Vendor information
  v.name AS vendor_name,
  pb.ptr_cost,

  -- Purchase reference
  pii.invoiceid AS purchase_invoice_id,
  pi.invoiceno AS purchase_invoice_number,

  -- Days to expiry
  (pb.expiry_date - CURRENT_DATE) AS days_to_expiry,

  -- Value at risk
  (pb.quantity_remaining * pb.ptr_cost) AS value_at_risk,

  -- Status flags
  CASE
    WHEN pb.expiry_date <= CURRENT_DATE THEN 'EXPIRED'
    WHEN pb.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_30'
    WHEN pb.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'EXPIRING_60'
    WHEN pb.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'EXPIRING_90'
    ELSE 'NORMAL'
  END AS expiry_status,

  pb.created_on,
  pb.created_by
FROM product_batch pb
INNER JOIN product p ON pb.product_id = p.id
LEFT JOIN vendor v ON pb.vendor_id = v.id
LEFT JOIN purchase_invoice_item pii ON pb.purchase_invoice_item_id = pii.id
LEFT JOIN purchase_invoice pi ON pii.invoiceid = pi.id
WHERE pb.active = true
ORDER BY pb.expiry_date ASC, p.title ASC;

COMMENT ON VIEW batch_inventory_view IS 'Comprehensive view of batch inventory with expiry status and value at risk';

-- =====================================================================
-- 6. DATA MIGRATION - POPULATE EXISTING BATCHES
-- =====================================================================

-- Migrate existing purchase invoice items to batch records
INSERT INTO product_batch (
  product_id,
  batch_number,
  expiry_date,
  manufactured_date,
  quantity_received,
  quantity_remaining,
  purchase_invoice_item_id,
  vendor_id,
  ptr_cost,
  received_date,
  status,
  created_on,
  created_by,
  active
)
SELECT
  pii.productid,
  COALESCE(pii.batch, 'LEGACY-' || pii.id::TEXT),  -- Generate batch if NULL
  COALESCE(pii.expdate, CURRENT_DATE + INTERVAL '2 years'),  -- Default 2 years if NULL
  pii.mfrdate,
  (pii.qty + COALESCE(pii.freeqty, 0)) * COALESCE(pii.packsize, 1),  -- Total received

  -- Calculate remaining using inventory_view if exists, otherwise assume all available
  COALESCE(
    (SELECT iv.available FROM inventory_view iv WHERE iv.purchase_itemid = pii.id LIMIT 1),
    (pii.qty + COALESCE(pii.freeqty, 0)) * COALESCE(pii.packsize, 1)
  ),

  pii.id,
  pi.vendorid,
  pii.ptrvalue,
  pi.invoicedate,

  -- Determine status
  CASE
    WHEN COALESCE(pii.expdate, CURRENT_DATE + INTERVAL '2 years') < CURRENT_DATE THEN 'EXPIRED'
    WHEN COALESCE(
      (SELECT iv.available FROM inventory_view iv WHERE iv.purchase_itemid = pii.id LIMIT 1),
      0
    ) = 0 THEN 'DEPLETED'
    ELSE 'ACTIVE'
  END,

  pii.createdon,
  pii.createdby,
  pii.active
FROM purchase_invoice_item pii
INNER JOIN purchase_invoice pi ON pii.invoiceid = pi.id
WHERE pii.status = 'VERIFIED'  -- Only migrate verified items
  AND pii.active = true
  AND NOT EXISTS (
    -- Don't migrate if batch already exists
    SELECT 1 FROM product_batch pb
    WHERE pb.purchase_invoice_item_id = pii.id
  )
ON CONFLICT (product_id, batch_number, expiry_date) DO NOTHING;

-- Log initial migration movements
INSERT INTO batch_movement_log (
  batch_id,
  movement_type,
  quantity,
  reference_type,
  reference_id,
  performed_by,
  performed_at,
  notes
)
SELECT
  pb.id,
  'RECEIVED',
  pb.quantity_received,
  'MIGRATION',
  pb.purchase_invoice_item_id,
  pb.created_by,
  pb.created_on,
  'Migrated from existing purchase_invoice_item during initial batch setup'
FROM product_batch pb
WHERE pb.purchase_invoice_item_id IS NOT NULL
  AND NOT EXISTS (
    -- Don't duplicate migration logs
    SELECT 1 FROM batch_movement_log bml
    WHERE bml.batch_id = pb.id
      AND bml.movement_type = 'RECEIVED'
      AND bml.reference_type = 'MIGRATION'
  );

-- =====================================================================
-- 7. GRANT PERMISSIONS
-- =====================================================================

-- Grant SELECT on tables and views to application role
-- GRANT SELECT, INSERT, UPDATE ON product_batch TO rgpapp;
-- GRANT SELECT, INSERT ON batch_movement_log TO rgpapp;
-- GRANT SELECT ON batch_inventory_view TO rgpapp;

-- Grant USAGE on sequences
-- GRANT USAGE ON SEQUENCE product_batch_id_seq TO rgpapp;
-- GRANT USAGE ON SEQUENCE batch_movement_log_id_seq TO rgpapp;

-- =====================================================================
-- MIGRATION SUMMARY
-- =====================================================================

DO $$
DECLARE
  v_batch_count INTEGER;
  v_movement_count INTEGER;
  v_active_count INTEGER;
  v_expired_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_batch_count FROM product_batch;
  SELECT COUNT(*) INTO v_movement_count FROM batch_movement_log;
  SELECT COUNT(*) INTO v_active_count FROM product_batch WHERE status = 'ACTIVE';
  SELECT COUNT(*) INTO v_expired_count FROM product_batch WHERE status = 'EXPIRED';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 009: Batch Management Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total batches created: %', v_batch_count;
  RAISE NOTICE 'Active batches: %', v_active_count;
  RAISE NOTICE 'Expired batches: %', v_expired_count;
  RAISE NOTICE 'Movement log entries: %', v_movement_count;
  RAISE NOTICE '========================================';
END $$;
