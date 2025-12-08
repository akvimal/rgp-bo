-- Migration 013: Comprehensive HSN Tax Master for Pharmacy (4-digit HSN codes)
-- Purpose: Complete HSN code setup with latest GST rates (Post Sep 22, 2025)
-- Author: System
-- Date: 2025-12-06
-- Target: Pharmacy business with turnover < ₹5 Crores
--
-- DESIGN PRINCIPLES:
-- 1. Use 4-digit HSN codes for better compliance and future-proofing
-- 2. Effective date tracking for easy tax rate updates
-- 3. Comprehensive pharmacy product categories
-- 4. Adaptable to future GST changes

BEGIN;

-- Clear existing data (since we just cleared all product/purchase data)
TRUNCATE TABLE hsn_tax_master RESTART IDENTITY CASCADE;

-- ============================================================================
-- MEDICINES (Chapter 30) - 5% GST (Post GST 2.0)
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    -- Medicaments containing antibiotics/vaccines (5% GST)
    ('3004', 'Medicaments (Medicines) - General', 2.5, 2.5, 5.0, '2025-09-22', 'MEDICINE', true),

    -- Specific medicine subcategories
    ('3003', 'Medicaments containing hormones (not mixed)', 2.5, 2.5, 5.0, '2025-09-22', 'MEDICINE', true),
    ('3002', 'Human blood; animal blood; antisera and vaccines', 2.5, 2.5, 5.0, '2025-09-22', 'MEDICINE', true),

    -- Ayurvedic/Herbal medicines (5% GST - reduced from 12%)
    ('3001', 'Glands and other organs for therapeutic uses', 2.5, 2.5, 5.0, '2025-09-22', 'AYURVEDA', true);

-- ============================================================================
-- CRITICAL LIFE-SAVING MEDICINES - 0% GST (Exempt)
-- ============================================================================

-- Note: The 36 critical drugs will have specific 8-digit HSN codes
-- These should be added when official notification is received
-- For now, we'll add placeholders that can be updated later
-- These won't conflict with general medicine 4-digit codes

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    -- Placeholder for critical drugs - to be replaced with actual 8-digit HSN codes
    -- from official GST notification listing 36 critical life-saving drugs
    ('30029999', 'Critical vaccines and antisera - Placeholder', 0, 0, 0, '2025-09-22', 'MEDICINE_CRITICAL', true),
    ('30049999', 'Critical cancer and rare disease drugs - Placeholder', 0, 0, 0, '2025-09-22', 'MEDICINE_CRITICAL', true);

-- ============================================================================
-- SURGICAL & MEDICAL SUPPLIES (Chapter 30) - 12% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('3005', 'Wadding, gauze, bandages and similar articles', 6.0, 6.0, 12.0, '2025-09-22', 'SURGICAL', true),
    ('3006', 'Pharmaceutical goods (surgical gloves, first aid boxes)', 6.0, 6.0, 12.0, '2025-09-22', 'SURGICAL', true);

-- ============================================================================
-- MEDICAL DEVICES & INSTRUMENTS (Chapter 90) - 12% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('9018', 'Medical, surgical, dental or veterinary instruments', 6.0, 6.0, 12.0, '2025-09-22', 'MEDICAL_DEVICE', true),
    ('9019', 'Mechano-therapy appliances; massage apparatus', 6.0, 6.0, 12.0, '2025-09-22', 'MEDICAL_DEVICE', true),
    ('9020', 'Breathing appliances and gas masks', 6.0, 6.0, 12.0, '2025-09-22', 'MEDICAL_DEVICE', true),
    ('9021', 'Orthopaedic appliances; splints and other fracture appliances', 6.0, 6.0, 12.0, '2025-09-22', 'MEDICAL_DEVICE', true),
    ('9022', 'X-ray apparatus and similar apparatus', 6.0, 6.0, 12.0, '2025-09-22', 'MEDICAL_DEVICE', true);

-- ============================================================================
-- OPTICAL PRODUCTS (Chapter 90) - 12% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('9001', 'Optical fibres and cables; lenses; prisms; mirrors', 6.0, 6.0, 12.0, '2025-09-22', 'OPTICAL', true),
    ('9004', 'Spectacles, goggles and the like', 6.0, 6.0, 12.0, '2025-09-22', 'OPTICAL', true);

-- ============================================================================
-- CONTRACEPTIVES (Chapter 40) - 12% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('4014', 'Sheath contraceptives (condoms)', 6.0, 6.0, 12.0, '2025-09-22', 'CONTRACEPTIVE', true);

-- ============================================================================
-- HYGIENE & BABY CARE (Chapter 96) - 12% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('9619', 'Sanitary towels, tampons, napkins and diapers', 6.0, 6.0, 12.0, '2025-09-22', 'HYGIENE', true);

-- ============================================================================
-- COSMETICS & BEAUTY PRODUCTS (Chapter 33) - 18% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('3303', 'Perfumes and toilet waters', 9.0, 9.0, 18.0, '2025-09-22', 'COSMETIC', true),
    ('3304', 'Beauty or make-up preparations and skin-care preparations', 9.0, 9.0, 18.0, '2025-09-22', 'COSMETIC', true),
    ('3305', 'Hair preparations (shampoo, hair oil, dye)', 9.0, 9.0, 18.0, '2025-09-22', 'HAIRCARE', true),
    ('3306', 'Oral or dental hygiene preparations (toothpaste, mouthwash)', 9.0, 9.0, 18.0, '2025-09-22', 'SKINCARE', true),
    ('3307', 'Pre-shave, shaving preparations, deodorants', 9.0, 9.0, 18.0, '2025-09-22', 'SKINCARE', true);

-- ============================================================================
-- SOAPS & DETERGENTS (Chapter 34) - 18% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('3401', 'Soap; organic surface-active products (bathing soap)', 9.0, 9.0, 18.0, '2025-09-22', 'FMCG', true),
    ('3402', 'Organic surface-active agents (detergents)', 9.0, 9.0, 18.0, '2025-09-22', 'FMCG', true);

-- ============================================================================
-- HEALTH SUPPLEMENTS & NUTRACEUTICALS (Chapter 21) - 18% GST
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('2106', 'Food preparations (protein powders, health supplements)', 9.0, 9.0, 18.0, '2025-09-22', 'SUPPLEMENT', true);

-- ============================================================================
-- FOOD ITEMS (Various chapters) - Mixed GST rates
-- ============================================================================

INSERT INTO hsn_tax_master
    (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
     effective_from, tax_category, active)
VALUES
    ('0402', 'Milk powder and condensed milk', 1.5, 1.5, 3.0, '2025-09-22', 'FOOD', true),
    ('1905', 'Bread, biscuits, cakes and other bakers wares', 9.0, 9.0, 18.0, '2025-09-22', 'FOOD', true),
    ('1902', 'Pasta, noodles and similar products', 9.0, 9.0, 18.0, '2025-09-22', 'FOOD', true),
    ('2202', 'Non-alcoholic beverages (juices, soft drinks)', 6.0, 6.0, 12.0, '2025-09-22', 'FOOD', true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Summary by category
SELECT
    tax_category,
    COUNT(*) as hsn_codes,
    MIN(cgst_rate + sgst_rate) as min_gst,
    MAX(cgst_rate + sgst_rate) as max_gst,
    STRING_AGG(DISTINCT (cgst_rate + sgst_rate)::text, ', ') as gst_rates
FROM hsn_tax_master
WHERE active = true AND effective_to >= CURRENT_DATE
GROUP BY tax_category
ORDER BY tax_category;

-- All HSN codes with rates
SELECT
    hsn_code,
    hsn_description,
    tax_category,
    cgst_rate,
    sgst_rate,
    igst_rate,
    (cgst_rate + sgst_rate) as total_gst,
    effective_from,
    effective_to
FROM hsn_tax_master
WHERE active = true AND effective_to >= CURRENT_DATE
ORDER BY tax_category, hsn_code;

-- Count by GST slab
SELECT
    (cgst_rate + sgst_rate) as gst_slab,
    COUNT(*) as count,
    STRING_AGG(DISTINCT tax_category, ', ') as categories
FROM hsn_tax_master
WHERE active = true AND effective_to >= CURRENT_DATE
GROUP BY gst_slab
ORDER BY gst_slab;

COMMIT;

-- ============================================================================
-- USAGE EXAMPLES FOR APPLICATION
-- ============================================================================

-- Example 1: Get tax rate for a specific HSN code
-- SELECT * FROM get_hsn_tax_rate('3004', CURRENT_DATE);

-- Example 2: Get tax rate for a product (after product has hsn_code)
-- SELECT * FROM get_product_tax_rate(1, CURRENT_DATE);

-- Example 3: Find all products in a specific tax category
-- SELECT p.*, htm.cgst_rate, htm.sgst_rate, htm.igst_rate
-- FROM product p
-- INNER JOIN hsn_tax_master htm ON htm.hsn_code = p.hsn_code
-- WHERE htm.tax_category = 'MEDICINE' AND htm.active = true
-- AND CURRENT_DATE BETWEEN htm.effective_from AND htm.effective_to;

-- ============================================================================
-- FUTURE TAX RATE UPDATE TEMPLATE
-- ============================================================================

-- When GST rates change in future, follow this pattern:
--
-- STEP 1: Close existing rate
-- UPDATE hsn_tax_master
-- SET effective_to = 'YYYY-MM-DD'  -- Day before new rate takes effect
-- WHERE hsn_code = 'XXXX' AND effective_to = '2099-12-31';
--
-- STEP 2: Insert new rate
-- INSERT INTO hsn_tax_master
--     (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate,
--      effective_from, tax_category, active)
-- VALUES
--     ('XXXX', 'Description', new_cgst, new_sgst, new_igst,
--      'YYYY-MM-DD', 'CATEGORY', true);
--
-- This maintains historical accuracy for old invoices while applying new rates

-- ============================================================================
-- NOTES FOR FUTURE MAINTENANCE
-- ============================================================================

-- 1. Always use effective_from and effective_to dates
-- 2. Never delete old rates - mark effective_to to close them
-- 3. Use 4-digit HSN codes for better classification
-- 4. Update this file when new product categories are added
-- 5. Verify against official GST portal before any tax rate change
-- 6. Test with get_hsn_tax_rate() function after updates

SELECT 'Migration 013 completed successfully!' as status;
SELECT 'Total HSN codes added: ' || COUNT(*) FROM hsn_tax_master WHERE active = true;
