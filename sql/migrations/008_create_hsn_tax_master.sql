-- Migration 007: Create HSN Tax Master Table
-- Purpose: Manage GST rates based on HSN codes
-- Author: System
-- Date: 2025-12-05

-- Create HSN Tax Master table
CREATE TABLE IF NOT EXISTS public.hsn_tax_master (
    id SERIAL PRIMARY KEY,
    hsn_code VARCHAR(8) NOT NULL,
    hsn_description VARCHAR(200),

    -- GST Rates (in percentage)
    cgst_rate NUMERIC(5,2) NOT NULL,
    sgst_rate NUMERIC(5,2) NOT NULL,
    igst_rate NUMERIC(5,2) NOT NULL,

    -- Effective dates for rate changes
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE DEFAULT '2099-12-31',

    -- Category for grouping
    tax_category VARCHAR(50),

    -- Audit fields
    active BOOLEAN DEFAULT true NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INTEGER,
    updated_by INTEGER,

    -- Constraints
    CONSTRAINT hsn_tax_master_unique UNIQUE (hsn_code, effective_from),
    CONSTRAINT hsn_tax_master_cgst_valid CHECK (cgst_rate >= 0 AND cgst_rate <= 50),
    CONSTRAINT hsn_tax_master_sgst_valid CHECK (sgst_rate >= 0 AND sgst_rate <= 50),
    CONSTRAINT hsn_tax_master_igst_valid CHECK (igst_rate >= 0 AND igst_rate <= 50),
    CONSTRAINT hsn_tax_master_igst_equals_cgst_plus_sgst CHECK (igst_rate = cgst_rate + sgst_rate)
);

-- Create indexes for performance
CREATE INDEX idx_hsn_tax_active ON hsn_tax_master(hsn_code, effective_to)
    WHERE active = true;

CREATE INDEX idx_hsn_tax_dates ON hsn_tax_master(hsn_code, effective_from, effective_to)
    WHERE active = true;

-- Comments
COMMENT ON TABLE hsn_tax_master IS 'Master table for HSN code to GST rate mapping';
COMMENT ON COLUMN hsn_tax_master.hsn_code IS 'HSN code (4-8 digits)';
COMMENT ON COLUMN hsn_tax_master.cgst_rate IS 'Central GST rate (%)';
COMMENT ON COLUMN hsn_tax_master.sgst_rate IS 'State GST rate (%)';
COMMENT ON COLUMN hsn_tax_master.igst_rate IS 'Integrated GST rate (%) for inter-state';
COMMENT ON COLUMN hsn_tax_master.effective_from IS 'Date from which this rate is applicable';
COMMENT ON COLUMN hsn_tax_master.effective_to IS 'Date until which this rate is applicable';
COMMENT ON COLUMN hsn_tax_master.tax_category IS 'Product category for grouping (MEDICINE, COSMETIC, FMCG, etc.)';

-- Function to get current tax rate for an HSN code
CREATE OR REPLACE FUNCTION get_hsn_tax_rate(
    p_hsn_code VARCHAR,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    cgst_rate NUMERIC,
    sgst_rate NUMERIC,
    igst_rate NUMERIC,
    total_rate NUMERIC,
    tax_category VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        htm.cgst_rate,
        htm.sgst_rate,
        htm.igst_rate,
        (htm.cgst_rate + htm.sgst_rate) as total_rate,
        htm.tax_category
    FROM hsn_tax_master htm
    WHERE htm.hsn_code = p_hsn_code
        AND htm.active = true
        AND p_date BETWEEN htm.effective_from AND htm.effective_to
    ORDER BY htm.effective_from DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_hsn_tax_rate IS 'Get current tax rates for an HSN code on a given date';

-- Function to get current tax rate for a product
CREATE OR REPLACE FUNCTION get_product_tax_rate(
    p_product_id INTEGER,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    cgst_rate NUMERIC,
    sgst_rate NUMERIC,
    igst_rate NUMERIC,
    total_rate NUMERIC,
    tax_category VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        htm.cgst_rate,
        htm.sgst_rate,
        htm.igst_rate,
        (htm.cgst_rate + htm.sgst_rate) as total_rate,
        htm.tax_category
    FROM product p
    INNER JOIN hsn_tax_master htm ON htm.hsn_code = p.hsn_code
    WHERE p.id = p_product_id
        AND htm.active = true
        AND p_date BETWEEN htm.effective_from AND htm.effective_to
    ORDER BY htm.effective_from DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_product_tax_rate IS 'Get current tax rates for a product based on its HSN code';
