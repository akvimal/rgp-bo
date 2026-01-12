-- Delete drug* products and add HSN codes to sample products
-- Date: 2025-12-07
-- Purpose: Clean up test drug products and add proper HSN codes

BEGIN;

-- ========================================
-- STEP 1: Delete DRUG* products and related data
-- ========================================

-- Delete product pricing first (foreign key dependency)
DELETE FROM product_price2 WHERE product_id IN (
    SELECT id FROM product WHERE title ILIKE 'drug%'
);

-- Delete vendor pricelist entries
DELETE FROM vendor_pricelist WHERE product_id IN (
    SELECT id FROM product WHERE title ILIKE 'drug%'
);

-- Delete the drug products
DELETE FROM product WHERE title ILIKE 'drug%';

-- ========================================
-- STEP 2: Add HSN codes to sample products
-- ========================================

-- Pharmaceutical products (HSN: 3004 - Medicaments)
UPDATE product SET hsn_code = '30049099'
WHERE title IN (
    'Paracetamol 500mg',
    'Ibuprofen 400mg',
    'Amoxicillin 250mg',
    'Cetirizine 10mg',
    'Omeprazole 20mg',
    'Aspirin 75mg',
    'Metformin 500mg',
    'Atorvastatin 10mg',
    'Losartan 50mg',
    'Antacid Tablets',
    'Cough Syrup 100ml',
    'Eye Drops 10ml',
    'Antibiotic Ointment 15g',
    'Antiseptic Cream 50g'
);

-- Vitamins and mineral supplements (HSN: 2936 - Provitamins and vitamins)
UPDATE product SET hsn_code = '29362900'
WHERE title IN (
    'Vitamin D3 1000IU',
    'Vitamin C 500mg',
    'Multivitamin Daily',
    'Calcium Tablets 500mg'
);

-- Medical devices and instruments (HSN: 9018)
UPDATE product SET hsn_code = '90189099'
WHERE title IN (
    'Digital Thermometer',
    'Blood Pressure Monitor',
    'Insulin Syringes (Pack 10)'
);

-- Diagnostic reagents (HSN: 3822 - Diagnostic or laboratory reagents)
UPDATE product SET hsn_code = '38220090'
WHERE title = 'Glucose Test Strips';

-- Wadding, gauze, bandages (HSN: 3005)
UPDATE product SET hsn_code = '30051000'
WHERE title = 'Bandage Roll 5cm';

-- Disinfectants (HSN: 3808 - Insecticides, disinfectants)
UPDATE product SET hsn_code = '38089400'
WHERE title = 'Hand Sanitizer 500ml';

-- Face masks (HSN: 6307 - Other made up articles)
UPDATE product SET hsn_code = '63079090'
WHERE title = 'Face Mask (Box of 50)';

COMMIT;

-- Display summary
SELECT 'Drug products deleted and HSN codes added successfully!' as message;
SELECT COUNT(*) as deleted_drug_products FROM product WHERE title ILIKE 'drug%';
SELECT COUNT(*) as products_with_hsn FROM product WHERE hsn_code IS NOT NULL AND active = true;
SELECT id, title, hsn_code, category FROM product WHERE active = true ORDER BY id DESC LIMIT 15;
