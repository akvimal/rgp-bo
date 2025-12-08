-- Update products with more specific and appropriate HSN codes
-- Date: 2025-12-07
-- Purpose: Assign accurate HSN codes for Indian GST compliance

BEGIN;

-- ========================================
-- Pain Relief Medications
-- ========================================

-- Paracetamol - HSN 30041090 (Medicaments containing paracetamol)
UPDATE product SET hsn_code = '30041090' WHERE title = 'Paracetamol 500mg';

-- Ibuprofen - HSN 30041090 (Medicaments containing ibuprofen)
UPDATE product SET hsn_code = '30041090' WHERE title = 'Ibuprofen 400mg';

-- Aspirin - HSN 30041090 (Medicaments containing acetylsalicylic acid)
UPDATE product SET hsn_code = '30041090' WHERE title = 'Aspirin 75mg';

-- ========================================
-- Antibiotics
-- ========================================

-- Amoxicillin - HSN 30041010 (Medicaments containing penicillins or their derivatives)
UPDATE product SET hsn_code = '30041010' WHERE title = 'Amoxicillin 250mg';

-- Antibiotic Ointment - HSN 30049099 (Other medicaments)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Antibiotic Ointment 15g';

-- ========================================
-- Other Pharmaceutical Products
-- ========================================

-- Cetirizine - HSN 30049099 (Other medicaments - antihistamine)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Cetirizine 10mg';

-- Omeprazole - HSN 30049099 (Other medicaments - proton pump inhibitor)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Omeprazole 20mg';

-- Metformin - HSN 30049099 (Other medicaments - antidiabetic)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Metformin 500mg';

-- Atorvastatin - HSN 30049099 (Other medicaments - statin)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Atorvastatin 10mg';

-- Losartan - HSN 30049099 (Other medicaments - antihypertensive)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Losartan 50mg';

-- Antacid Tablets - HSN 30049099 (Other medicaments)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Antacid Tablets';

-- Cough Syrup - HSN 30049011 (Ayurvedic medicaments) or 30049099
UPDATE product SET hsn_code = '30049011' WHERE title = 'Cough Syrup 100ml';

-- Eye Drops - HSN 30049099 (Other medicaments)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Eye Drops 10ml';

-- Antiseptic Cream - HSN 30049099 (Other medicaments)
UPDATE product SET hsn_code = '30049099' WHERE title = 'Antiseptic Cream 50g';

-- ========================================
-- Vitamins and Supplements
-- ========================================

-- Vitamin D3 - HSN 30045020 (Medicaments containing vitamins)
UPDATE product SET hsn_code = '30045020' WHERE title = 'Vitamin D3 1000IU';

-- Vitamin C - HSN 29362200 (Vitamin C and its derivatives)
UPDATE product SET hsn_code = '29362200' WHERE title = 'Vitamin C 500mg';

-- Multivitamin - HSN 30045020 (Medicaments containing vitamins)
UPDATE product SET hsn_code = '30045020' WHERE title = 'Multivitamin Daily';

-- Calcium Tablets - HSN 30045040 (Medicaments containing calcium)
UPDATE product SET hsn_code = '30045040' WHERE title = 'Calcium Tablets 500mg';

-- ========================================
-- Medical Devices and Instruments
-- ========================================

-- Digital Thermometer - HSN 90251110 (Clinical thermometers)
UPDATE product SET hsn_code = '90251110' WHERE title = 'Digital Thermometer';

-- Blood Pressure Monitor - HSN 90189019 (Other instruments for measuring blood pressure)
UPDATE product SET hsn_code = '90189019' WHERE title = 'Blood Pressure Monitor';

-- Insulin Syringes - HSN 90183110 (Syringes with or without needles)
UPDATE product SET hsn_code = '90183110' WHERE title = 'Insulin Syringes (Pack 10)';

-- ========================================
-- Diagnostic and Laboratory Products
-- ========================================

-- Glucose Test Strips - HSN 38220012 (Diagnostic reagents based on immunological reactions)
UPDATE product SET hsn_code = '38220012' WHERE title = 'Glucose Test Strips';

-- ========================================
-- First Aid and Medical Supplies
-- ========================================

-- Bandage Roll - HSN 30051010 (Adhesive dressings and other articles having an adhesive layer)
UPDATE product SET hsn_code = '30051010' WHERE title = 'Bandage Roll 5cm';

-- ========================================
-- Hygiene and PPE
-- ========================================

-- Hand Sanitizer - HSN 38089400 (Disinfectants)
UPDATE product SET hsn_code = '38089400' WHERE title = 'Hand Sanitizer 500ml';

-- Face Mask - HSN 90200090 (Other breathing appliances and gas masks)
UPDATE product SET hsn_code = '90200090' WHERE title = 'Face Mask (Box of 50)';

COMMIT;

-- Display summary
SELECT 'HSN codes updated successfully!' as message;
SELECT
    hsn_code,
    COUNT(*) as product_count,
    STRING_AGG(title, ', ' ORDER BY title) as products
FROM product
WHERE active = true AND archive = false
GROUP BY hsn_code
ORDER BY hsn_code;
