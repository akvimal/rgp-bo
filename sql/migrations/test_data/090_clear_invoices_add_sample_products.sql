-- Clear existing invoice data and add sample products
-- Date: 2025-12-07
-- Purpose: Reset invoice data and populate sample products for testing

BEGIN;

-- ========================================
-- STEP 1: Clear Invoice Data
-- ========================================

-- Clear purchase invoice items first (foreign key dependency)
DELETE FROM purchase_invoice_item;

-- Clear purchase invoices
DELETE FROM purchase_invoice;

-- Clear sale return items
DELETE FROM sale_return_item;

-- Clear sale items
DELETE FROM sale_item;

-- Clear sales
DELETE FROM sale;

-- Clear delivery records
DELETE FROM sale_deliveries;

-- Reset sequences
ALTER SEQUENCE IF EXISTS purchase_invoice_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS purchase_invoice_item_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sale_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sale_item_id_seq RESTART WITH 1;

-- ========================================
-- STEP 2: Clear existing products (optional)
-- ========================================

-- Uncomment these if you want to clear existing products
-- DELETE FROM product_price2;
-- DELETE FROM product_pricechange;
-- DELETE FROM product_qtychange;
-- DELETE FROM product_clearance;
-- DELETE FROM product;
-- ALTER SEQUENCE IF EXISTS product_id_seq1 RESTART WITH 1;

-- ========================================
-- STEP 3: Add Sample Products
-- ========================================

-- Insert sample pharmacy products
INSERT INTO product (title, description, mfr, category, active, archive, tax_pcnt) VALUES
('Paracetamol 500mg', 'Pain reliever and fever reducer', 'PharmaCo', 'Pain Relief', true, false, 12.0),
('Ibuprofen 400mg', 'Anti-inflammatory pain relief', 'MediGen', 'Pain Relief', true, false, 12.0),
('Amoxicillin 250mg', 'Antibiotic for bacterial infections', 'AntiBio Labs', 'Antibiotics', true, false, 12.0),
('Cetirizine 10mg', 'Antihistamine for allergies', 'AllerFree', 'Allergy', true, false, 12.0),
('Omeprazole 20mg', 'Proton pump inhibitor for acid reflux', 'GastroCare', 'Gastric', true, false, 12.0),
('Aspirin 75mg', 'Blood thinner and pain relief', 'CardioMed', 'Cardiovascular', true, false, 12.0),
('Metformin 500mg', 'Diabetes medication', 'DiabCare', 'Diabetes', true, false, 12.0),
('Atorvastatin 10mg', 'Cholesterol lowering medication', 'CardioMed', 'Cardiovascular', true, false, 12.0),
('Losartan 50mg', 'Blood pressure medication', 'HyperCare', 'Cardiovascular', true, false, 12.0),
('Vitamin D3 1000IU', 'Vitamin supplement', 'VitaHealth', 'Vitamins', true, false, 5.0),
('Vitamin C 500mg', 'Immune system support', 'VitaHealth', 'Vitamins', true, false, 5.0),
('Multivitamin Daily', 'Complete daily vitamin supplement', 'VitaHealth', 'Vitamins', true, false, 5.0),
('Cough Syrup 100ml', 'Relief for cough and cold', 'ColdCare', 'Cold & Flu', true, false, 18.0),
('Antiseptic Cream 50g', 'Topical antiseptic for minor cuts', 'FirstAid', 'First Aid', true, false, 18.0),
('Bandage Roll 5cm', 'Medical bandage roll', 'MedSupply', 'First Aid', true, false, 18.0),
('Digital Thermometer', 'Instant digital temperature reading', 'HealthTech', 'Medical Devices', true, false, 18.0),
('Blood Pressure Monitor', 'Automatic BP monitor', 'HealthTech', 'Medical Devices', true, false, 18.0),
('Glucose Test Strips', 'Blood glucose testing strips (50 pack)', 'DiabCare', 'Diabetes', true, false, 12.0),
('Hand Sanitizer 500ml', 'Alcohol-based hand sanitizer', 'HygienePlus', 'Hygiene', true, false, 18.0),
('Face Mask (Box of 50)', 'Disposable 3-ply face masks', 'SafeGuard', 'PPE', true, false, 18.0),
('Calcium Tablets 500mg', 'Bone health supplement', 'VitaHealth', 'Vitamins', true, false, 5.0),
('Eye Drops 10ml', 'Lubricating eye drops', 'VisionCare', 'Eye Care', true, false, 12.0),
('Antibiotic Ointment 15g', 'Topical antibiotic', 'FirstAid', 'First Aid', true, false, 18.0),
('Antacid Tablets', 'Quick relief from heartburn', 'GastroCare', 'Gastric', true, false, 12.0),
('Insulin Syringes (Pack 10)', 'Disposable insulin syringes', 'DiabCare', 'Diabetes', true, false, 12.0)
ON CONFLICT (title) DO NOTHING;

-- ========================================
-- STEP 4: Add Product Pricing
-- ========================================

-- Insert prices for all products with current product_price2 schema
INSERT INTO product_price2 (product_id, sale_price, mrp, base_price, tax_pcnt, tax_inclusive, eff_date, end_date, active, archive)
SELECT
    p.id,
    CASE
        WHEN p.title LIKE '%Thermometer%' THEN 249.00
        WHEN p.title LIKE '%Blood Pressure%' THEN 1299.00
        WHEN p.title LIKE '%Test Strips%' THEN 799.00
        WHEN p.title LIKE '%Insulin%' THEN 129.00
        WHEN p.title LIKE '%Paracetamol%' THEN 20.00
        WHEN p.title LIKE '%Ibuprofen%' THEN 28.00
        WHEN p.title LIKE '%Amoxicillin%' THEN 75.00
        WHEN p.title LIKE '%Cetirizine%' THEN 38.00
        WHEN p.title LIKE '%Omeprazole%' THEN 105.00
        WHEN p.title LIKE '%Aspirin%' THEN 15.00
        WHEN p.title LIKE '%Metformin%' THEN 55.00
        WHEN p.title LIKE '%Atorvastatin%' THEN 80.00
        WHEN p.title LIKE '%Losartan%' THEN 95.00
        WHEN p.title LIKE '%Vitamin D%' THEN 169.00
        WHEN p.title LIKE '%Vitamin C%' THEN 125.00
        WHEN p.title LIKE '%Multivitamin%' THEN 209.00
        WHEN p.title LIKE '%Cough%' THEN 72.00
        WHEN p.title LIKE '%Antiseptic%' THEN 45.00
        WHEN p.title LIKE '%Bandage%' THEN 28.00
        WHEN p.title LIKE '%Sanitizer%' THEN 169.00
        WHEN p.title LIKE '%Face Mask%' THEN 339.00
        WHEN p.title LIKE '%Calcium%' THEN 149.00
        WHEN p.title LIKE '%Eye Drops%' THEN 62.00
        WHEN p.title LIKE '%Antibiotic Ointment%' THEN 55.00
        WHEN p.title LIKE '%Antacid%' THEN 35.00
        ELSE 85.00
    END as sale_price,
    CASE
        WHEN p.title LIKE '%Thermometer%' THEN 299.00
        WHEN p.title LIKE '%Blood Pressure%' THEN 1499.00
        WHEN p.title LIKE '%Test Strips%' THEN 899.00
        WHEN p.title LIKE '%Insulin%' THEN 149.00
        WHEN p.title LIKE '%Paracetamol%' THEN 25.00
        WHEN p.title LIKE '%Ibuprofen%' THEN 35.00
        WHEN p.title LIKE '%Amoxicillin%' THEN 89.00
        WHEN p.title LIKE '%Cetirizine%' THEN 45.00
        WHEN p.title LIKE '%Omeprazole%' THEN 125.00
        WHEN p.title LIKE '%Aspirin%' THEN 18.00
        WHEN p.title LIKE '%Metformin%' THEN 65.00
        WHEN p.title LIKE '%Atorvastatin%' THEN 95.00
        WHEN p.title LIKE '%Losartan%' THEN 110.00
        WHEN p.title LIKE '%Vitamin D%' THEN 199.00
        WHEN p.title LIKE '%Vitamin C%' THEN 149.00
        WHEN p.title LIKE '%Multivitamin%' THEN 249.00
        WHEN p.title LIKE '%Cough%' THEN 85.00
        WHEN p.title LIKE '%Antiseptic%' THEN 55.00
        WHEN p.title LIKE '%Bandage%' THEN 35.00
        WHEN p.title LIKE '%Sanitizer%' THEN 199.00
        WHEN p.title LIKE '%Face Mask%' THEN 399.00
        WHEN p.title LIKE '%Calcium%' THEN 179.00
        WHEN p.title LIKE '%Eye Drops%' THEN 75.00
        WHEN p.title LIKE '%Antibiotic Ointment%' THEN 68.00
        WHEN p.title LIKE '%Antacid%' THEN 42.00
        ELSE 100.00
    END as mrp,
    CASE
        WHEN p.title LIKE '%Thermometer%' THEN 180.00
        WHEN p.title LIKE '%Blood Pressure%' THEN 950.00
        WHEN p.title LIKE '%Test Strips%' THEN 600.00
        WHEN p.title LIKE '%Insulin%' THEN 95.00
        WHEN p.title LIKE '%Paracetamol%' THEN 12.00
        WHEN p.title LIKE '%Ibuprofen%' THEN 18.00
        WHEN p.title LIKE '%Amoxicillin%' THEN 50.00
        WHEN p.title LIKE '%Cetirizine%' THEN 25.00
        WHEN p.title LIKE '%Omeprazole%' THEN 70.00
        WHEN p.title LIKE '%Aspirin%' THEN 10.00
        WHEN p.title LIKE '%Metformin%' THEN 35.00
        WHEN p.title LIKE '%Atorvastatin%' THEN 55.00
        WHEN p.title LIKE '%Losartan%' THEN 65.00
        WHEN p.title LIKE '%Vitamin D%' THEN 120.00
        WHEN p.title LIKE '%Vitamin C%' THEN 85.00
        WHEN p.title LIKE '%Multivitamin%' THEN 145.00
        WHEN p.title LIKE '%Cough%' THEN 48.00
        WHEN p.title LIKE '%Antiseptic%' THEN 30.00
        WHEN p.title LIKE '%Bandage%' THEN 18.00
        WHEN p.title LIKE '%Sanitizer%' THEN 115.00
        WHEN p.title LIKE '%Face Mask%' THEN 240.00
        WHEN p.title LIKE '%Calcium%' THEN 105.00
        WHEN p.title LIKE '%Eye Drops%' THEN 42.00
        WHEN p.title LIKE '%Antibiotic Ointment%' THEN 38.00
        WHEN p.title LIKE '%Antacid%' THEN 22.00
        ELSE 60.00
    END as base_price,
    p.tax_pcnt as tax_pcnt,
    false as tax_inclusive,
    CURRENT_DATE as eff_date,
    '2099-12-31'::date as end_date,
    true as active,
    false as archive
FROM product p
WHERE NOT EXISTS (
    SELECT 1 FROM product_price2 pp WHERE pp.product_id = p.id AND pp.active = true AND pp.archive = false
);

COMMIT;

-- Display summary
SELECT 'Data cleared and sample products added successfully!' as message;
SELECT COUNT(*) as total_products FROM product WHERE active = true AND archive = false;
SELECT COUNT(*) as products_with_pricing FROM product_price2 WHERE active = true AND archive = false;
