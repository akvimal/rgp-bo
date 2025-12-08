-- Migration 012: Create Sales Intent Management System
-- Purpose: Capture product requirements from sales staff for customer requests, low stock, etc.
-- Date: 2025-12-07

-- ============================================================================
-- Sales Intent Table
-- ============================================================================
-- Captures product requirement requests from sales staff
-- Can be linked to customer requests with advance payments
-- Used by purchase staff to generate POs

CREATE TABLE IF NOT EXISTS sales_intent (
    id SERIAL PRIMARY KEY,

    -- Intent Details
    intentno VARCHAR(50) NOT NULL UNIQUE,  -- Auto-generated intent number (e.g., INT-2024-001)
    intenttype VARCHAR(20) NOT NULL CHECK (intenttype IN ('CUSTOMER_REQUEST', 'LOW_STOCK', 'MARKET_DEMAND', 'OTHER')),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),

    -- Product Information
    prodid INT4 REFERENCES product(id) ON DELETE RESTRICT,  -- NULL for new products not yet in system
    productname VARCHAR(100) NOT NULL,  -- Product name (can be manually entered for new products)
    requestedqty INT4 NOT NULL CHECK (requestedqty > 0),

    -- Customer Information (optional)
    customerid INT4 REFERENCES customer(id) ON DELETE SET NULL,
    customername VARCHAR(100),  -- Denormalized for quick reference
    customermobile VARCHAR(15),  -- Contact info for notification

    -- Financial Details (optional)
    advanceamount DECIMAL(10,2) DEFAULT 0.00,  -- Customer advance payment
    estimatedcost DECIMAL(10,2),  -- Estimated product cost

    -- Status and Workflow
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PO', 'FULFILLED', 'CANCELLED')),
    fulfillmentstatus VARCHAR(20) DEFAULT 'NOT_STARTED' CHECK (fulfillmentstatus IN ('NOT_STARTED', 'PO_CREATED', 'GOODS_RECEIVED', 'CUSTOMER_NOTIFIED', 'DELIVERED')),

    -- Notes and Comments
    requestnotes TEXT,  -- Why this product is needed
    internalnotes TEXT,  -- Internal notes for purchase staff

    -- Fulfillment Tracking
    purchaseorderid INT4 REFERENCES purchase_order(id) ON DELETE SET NULL,  -- Linked PO
    fulfilledon TIMESTAMPTZ,  -- When goods were received
    notifiedon TIMESTAMPTZ,  -- When customer was notified
    deliveredon TIMESTAMPTZ,  -- When delivered to customer

    -- Standard Audit Columns
    active BOOLEAN DEFAULT TRUE NOT NULL,
    archive BOOLEAN DEFAULT FALSE NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INT4 REFERENCES app_user(id),
    updated_by INT4 REFERENCES app_user(id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_intent_intentno ON sales_intent(intentno);
CREATE INDEX IF NOT EXISTS idx_sales_intent_status ON sales_intent(status);
CREATE INDEX IF NOT EXISTS idx_sales_intent_customerid ON sales_intent(customerid);
CREATE INDEX IF NOT EXISTS idx_sales_intent_prodid ON sales_intent(prodid);
CREATE INDEX IF NOT EXISTS idx_sales_intent_purchaseorderid ON sales_intent(purchaseorderid);
CREATE INDEX IF NOT EXISTS idx_sales_intent_intenttype ON sales_intent(intenttype);
CREATE INDEX IF NOT EXISTS idx_sales_intent_priority ON sales_intent(priority);
CREATE INDEX IF NOT EXISTS idx_sales_intent_created_on ON sales_intent(created_on DESC);

-- ============================================================================
-- Function: Generate Intent Number
-- ============================================================================
-- Auto-generates sequential intent numbers in format: INT-YYYY-NNN

CREATE OR REPLACE FUNCTION generate_intent_number()
RETURNS VARCHAR AS $$
DECLARE
    new_intent_no VARCHAR(50);
    current_year VARCHAR(4);
    sequence_num INT;
BEGIN
    -- Get current year
    current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Get next sequence number for this year with row-level lock
    SELECT COALESCE(MAX(CAST(SUBSTRING(intentno FROM 10) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM sales_intent
    WHERE intentno LIKE 'INT-' || current_year || '-%'
    FOR UPDATE;

    -- Generate intent number: INT-YYYY-001
    new_intent_no := 'INT-' || current_year || '-' || LPAD(sequence_num::TEXT, 3, '0');

    RETURN new_intent_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE sales_intent IS 'Sales intent requests for product requirements from sales staff';
COMMENT ON COLUMN sales_intent.intenttype IS 'Type: CUSTOMER_REQUEST, LOW_STOCK, MARKET_DEMAND, OTHER';
COMMENT ON COLUMN sales_intent.priority IS 'Priority level: LOW, MEDIUM, HIGH, URGENT';
COMMENT ON COLUMN sales_intent.status IS 'Overall status: PENDING, IN_PO, FULFILLED, CANCELLED';
COMMENT ON COLUMN sales_intent.fulfillmentstatus IS 'Fulfillment stage: NOT_STARTED, PO_CREATED, GOODS_RECEIVED, CUSTOMER_NOTIFIED, DELIVERED';
COMMENT ON COLUMN sales_intent.advanceamount IS 'Customer advance payment amount';
COMMENT ON COLUMN sales_intent.purchaseorderid IS 'Linked purchase order if PO created';

-- ============================================================================
-- Sample Data for Testing
-- ============================================================================

-- This will be populated by the application
-- Example intent types:
-- 1. Customer Request with Advance: Customer requests specific product and pays advance
-- 2. Low Stock: Sales staff identifies product running low
-- 3. Market Demand: Sales staff predicts upcoming demand

-- ============================================================================
-- End of Migration 012
-- ============================================================================
