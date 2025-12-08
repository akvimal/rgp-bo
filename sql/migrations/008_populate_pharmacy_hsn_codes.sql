-- Migration 008: Populate Common Pharmacy HSN Codes
-- Purpose: Insert common pharmaceutical and healthcare product HSN codes with GST rates
-- Author: System
-- Date: 2025-12-05
-- Reference: GST Council Notification as of 2024

-- Medicines and Pharmaceutical Products
INSERT INTO hsn_tax_master (hsn_code, hsn_description, cgst_rate, sgst_rate, igst_rate, tax_category) VALUES
-- Medicaments (5% GST for most medicines)
('30049011', 'Antibiotics', 6, 6, 12, 'MEDICINE'),
('30049012', 'Vaccines', 6, 6, 12, 'MEDICINE'),
('30049013', 'Hormones', 6, 6, 12, 'MEDICINE'),
('30049014', 'Analgesics', 6, 6, 12, 'MEDICINE'),
('30049019', 'Other medicaments containing anti-malarials', 6, 6, 12, 'MEDICINE'),
('30049099', 'Other medicaments (general)', 6, 6, 12, 'MEDICINE'),

-- Surgical items (12% GST)
('30051010', 'Adhesive dressings', 6, 6, 12, 'SURGICAL'),
('30059010', 'First aid boxes', 6, 6, 12, 'SURGICAL'),
('30059091', 'Medical dressings', 6, 6, 12, 'SURGICAL'),
('30067090', 'Surgical gloves', 6, 6, 12, 'SURGICAL'),

-- Ayurvedic/Herbal Medicines (12% GST)
('30039011', 'Ayurvedic medicines', 6, 6, 12, 'AYURVEDA'),
('30039019', 'Other ayurvedic/herbal medicines', 6, 6, 12, 'AYURVEDA'),

-- Cosmetics and Beauty Products (18% GST)
('33041000', 'Lip make-up preparations', 9, 9, 18, 'COSMETIC'),
('33042000', 'Eye make-up preparations', 9, 9, 18, 'COSMETIC'),
('33043000', 'Manicure or pedicure preparations', 9, 9, 18, 'COSMETIC'),
('33049100', 'Powders, whether or not compressed', 9, 9, 18, 'COSMETIC'),
('33049900', 'Other beauty/make-up preparations', 9, 9, 18, 'COSMETIC'),

-- Hair care products (18% GST)
('33051000', 'Shampoos', 9, 9, 18, 'HAIRCARE'),
('33052000', 'Hair permanent waving preparations', 9, 9, 18, 'HAIRCARE'),
('33053000', 'Hair lacquers', 9, 9, 18, 'HAIRCARE'),
('33059000', 'Other hair preparations', 9, 9, 18, 'HAIRCARE'),

-- Skin care (18% GST)
('33061000', 'Dentifrices', 9, 9, 18, 'SKINCARE'),
('33072000', 'Personal deodorants and anti-perspirants', 9, 9, 18, 'SKINCARE'),
('33074100', 'Agarbatti and other odoriferous preparations', 9, 9, 18, 'SKINCARE'),
('33079000', 'Other perfumery, cosmetic or toilet preparations', 9, 9, 18, 'SKINCARE'),

-- Baby care products (12% GST)
('96190010', 'Sanitary towels and tampons', 6, 6, 12, 'HYGIENE'),
('96190020', 'Napkins and napkin liners for babies', 6, 6, 12, 'BABYCARE'),

-- Health supplements (18% GST)
('21069030', 'Protein concentrates', 9, 9, 18, 'SUPPLEMENT'),
('21069099', 'Other food preparations (health supplements)', 9, 9, 18, 'SUPPLEMENT'),

-- Medical devices (12% GST)
('90181100', 'Electro-cardiographs', 6, 6, 12, 'MEDICAL_DEVICE'),
('90181900', 'Other electro-diagnostic apparatus', 6, 6, 12, 'MEDICAL_DEVICE'),
('90183100', 'Syringes', 6, 6, 12, 'MEDICAL_DEVICE'),
('90183910', 'Catheters', 6, 6, 12, 'MEDICAL_DEVICE'),
('90189011', 'Digital thermometers', 6, 6, 12, 'MEDICAL_DEVICE'),
('90189019', 'Other thermometers', 6, 6, 12, 'MEDICAL_DEVICE'),
('90189099', 'Other medical instruments', 6, 6, 12, 'MEDICAL_DEVICE'),

-- Contact lenses (12% GST)
('90013000', 'Contact lenses', 6, 6, 12, 'OPTICAL'),
('90049090', 'Other spectacles', 6, 6, 12, 'OPTICAL'),

-- Condoms (12% GST)
('40141000', 'Sheath contraceptives (condoms)', 6, 6, 12, 'CONTRACEPTIVE'),

-- Soaps (18% GST)
('34011110', 'Bathing soap', 9, 9, 18, 'FMCG'),
('34011190', 'Other soap', 9, 9, 18, 'FMCG'),
('34012010', 'Detergent powder', 9, 9, 18, 'FMCG'),
('34012090', 'Other detergent', 9, 9, 18, 'FMCG'),

-- Essential items (Nil or 5%)
('04021010', 'Milk powder', 1.5, 1.5, 3, 'FOOD'),
('19023000', 'Pasta', 9, 9, 18, 'FOOD'),
('21069010', 'Diabetic foods', 6, 6, 12, 'FOOD');

-- Add comments for clarity
COMMENT ON TABLE hsn_tax_master IS 'GST rates as per GST Council notifications. Update when rates change.';

-- Summary report
SELECT
    tax_category,
    COUNT(*) as count,
    MIN(cgst_rate + sgst_rate) as min_gst_rate,
    MAX(cgst_rate + sgst_rate) as max_gst_rate
FROM hsn_tax_master
WHERE active = true
GROUP BY tax_category
ORDER BY tax_category;
