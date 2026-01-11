-- Populate detailed pharmacy HSN codes in hsn_tax_master
-- Date: 2025-12-07
-- Purpose: Add specific 8-digit HSN codes for pharmacy products

BEGIN;

-- Insert detailed HSN codes for pharmaceutical products
INSERT INTO hsn_tax_master (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate, tax_category, effective_from, effective_to, active, archive)
VALUES
-- Pain Relief Medications (3004)
('30041090', 'Medicaments containing paracetamol, ibuprofen, or acetylsalicylic acid', 6.00, 6.00, 12.00, 'MEDICINES', '2017-07-01', '2099-12-31', true, false),
('30041010', 'Medicaments containing penicillins or their derivatives', 6.00, 6.00, 12.00, 'MEDICINES', '2017-07-01', '2099-12-31', true, false),
('30049099', 'Other medicaments (antihistamine, antacid, etc.)', 6.00, 6.00, 12.00, 'MEDICINES', '2017-07-01', '2099-12-31', true, false),

-- Ayurvedic Medicaments
('30049011', 'Ayurvedic medicaments', 6.00, 6.00, 12.00, 'MEDICINES', '2017-07-01', '2099-12-31', true, false),

-- Vitamins and Supplements
('30045020', 'Medicaments containing vitamins or other products of 2936', 6.00, 6.00, 12.00, 'MEDICINES', '2017-07-01', '2099-12-31', true, false),
('30045040', 'Medicaments containing calcium', 6.00, 6.00, 12.00, 'MEDICINES', '2017-07-01', '2099-12-31', true, false),
('29362200', 'Vitamin C and its derivatives', 6.00, 6.00, 12.00, 'VITAMINS', '2017-07-01', '2099-12-31', true, false),

-- Medical Devices and Instruments
('90251110', 'Clinical thermometers', 6.00, 6.00, 12.00, 'MEDICAL_DEVICES', '2017-07-01', '2099-12-31', true, false),
('90189019', 'Other instruments for measuring blood pressure', 6.00, 6.00, 12.00, 'MEDICAL_DEVICES', '2017-07-01', '2099-12-31', true, false),
('90183110', 'Syringes with or without needles', 6.00, 6.00, 12.00, 'MEDICAL_DEVICES', '2017-07-01', '2099-12-31', true, false),

-- Diagnostic Products
('38220012', 'Diagnostic reagents based on immunological reactions', 6.00, 6.00, 12.00, 'DIAGNOSTIC', '2017-07-01', '2099-12-31', true, false),

-- First Aid Supplies
('30051010', 'Adhesive dressings and other articles having an adhesive layer', 9.00, 9.00, 18.00, 'MEDICAL_SUPPLIES', '2017-07-01', '2099-12-31', true, false),

-- Hygiene and PPE
('38089400', 'Disinfectants (hand sanitizer)', 9.00, 9.00, 18.00, 'HYGIENE', '2017-07-01', '2099-12-31', true, false),
('90200090', 'Other breathing appliances and gas masks (face masks)', 9.00, 9.00, 18.00, 'SAFETY_EQUIPMENT', '2017-07-01', '2099-12-31', true, false)

ON CONFLICT (hsn_code, effective_from) DO UPDATE SET
    hsn_description = EXCLUDED.hsn_description,
    cgst_rate = EXCLUDED.cgst_rate,
    sgst_rate = EXCLUDED.sgst_rate,
    igst_rate = EXCLUDED.igst_rate,
    tax_category = EXCLUDED.tax_category,
    active = true,
    archive = false;

COMMIT;

-- Display results
SELECT 'Pharmacy HSN codes populated successfully!' as message;
SELECT COUNT(*) as total_hsn_codes FROM hsn_tax_master WHERE active = true;
SELECT hsn_code, hsn_description, igst_rate
FROM hsn_tax_master
WHERE active = true AND hsn_code LIKE '30%' OR hsn_code LIKE '38%' OR hsn_code LIKE '90%' OR hsn_code LIKE '29%'
ORDER BY hsn_code;
