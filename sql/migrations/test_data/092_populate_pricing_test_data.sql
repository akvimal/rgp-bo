-- Migration 016: Populate pricing test data for pharmacy products
-- Date: 2025-12-07
-- Purpose: Create purchase invoices and pricing data to test enhanced pricing features

BEGIN;

-- Step 1: Ensure we have a test vendor
INSERT INTO vendor (business_name, contact_name, contact_phone, address, active, archive)
VALUES ('MedSupply Pharma Pvt Ltd', 'Rajesh Kumar', '+91-9876543210',
        '123 Pharma Street, Mumbai, Maharashtra 400001', true, false)
ON CONFLICT (business_name) DO NOTHING;

-- Get the vendor ID (assuming it's the first vendor or we just created it)
DO $$
DECLARE
    v_vendor_id INTEGER;
    v_product_id INTEGER;
    v_invoice_id INTEGER;
    v_user_id INTEGER := 1; -- Admin user
    v_store_id INTEGER := 1; -- Default store
    v_invoice_number VARCHAR := 'INV-TEST-001';
BEGIN
    -- Get or create vendor
    SELECT id INTO v_vendor_id FROM vendor WHERE business_name = 'MedSupply Pharma Pvt Ltd' LIMIT 1;

    -- Create purchase invoice
    INSERT INTO purchase_invoice (
        invoice_no, vendor_id, store_id, invoice_date,
        total, paid_amount, payment_status,
        active, archive, created_by, created_on
    )
    VALUES (
        v_invoice_number, v_vendor_id, v_store_id, CURRENT_DATE,
        50000.00, 50000.00, 'PAID',
        true, false, v_user_id, CURRENT_TIMESTAMP
    )
    RETURNING id INTO v_invoice_id;

    -- Add purchase invoice items for first 10 products with PTR prices
    -- Product 1: Paracetamol 500mg
    SELECT id INTO v_product_id FROM product WHERE title = 'Paracetamol 500mg';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 100, 2.50, 5.00, 4.50, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 5.00,
            sale_price = 4.50,
            base_price = 2.80,
            margin_pcnt = 25.00,
            discount_pcnt = 10.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 2: Ibuprofen 400mg
    SELECT id INTO v_product_id FROM product WHERE title = 'Ibuprofen 400mg';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 80, 3.00, 6.50, 5.50, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 6.50,
            sale_price = 5.50,
            base_price = 3.36,
            margin_pcnt = 30.00,
            discount_pcnt = 15.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 3: Amoxicillin 250mg
    SELECT id INTO v_product_id FROM product WHERE title = 'Amoxicillin 250mg';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 60, 8.00, 15.00, 13.80, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 15.00,
            sale_price = 13.80,
            base_price = 8.96,
            margin_pcnt = 20.00,
            discount_pcnt = 8.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 4: Cetirizine 10mg
    SELECT id INTO v_product_id FROM product WHERE title = 'Cetirizine 10mg';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 120, 1.50, 3.00, 2.85, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 3.00,
            sale_price = 2.85,
            base_price = 1.68,
            margin_pcnt = 35.00,
            discount_pcnt = 5.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 5: Omeprazole 20mg
    SELECT id INTO v_product_id FROM product WHERE title = 'Omeprazole 20mg';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 90, 4.50, 9.00, 7.92, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 9.00,
            sale_price = 7.92,
            base_price = 5.04,
            margin_pcnt = 22.00,
            discount_pcnt = 12.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 6: Vitamin C 500mg
    SELECT id INTO v_product_id FROM product WHERE title = 'Vitamin C 500mg';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 150, 2.00, 4.50, 4.05, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 4.50,
            sale_price = 4.05,
            base_price = 2.24,
            margin_pcnt = 28.00,
            discount_pcnt = 10.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 7: Multivitamin Tablet
    SELECT id INTO v_product_id FROM product WHERE title = 'Multivitamin Tablet';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 100, 5.00, 10.00, 9.20, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 10.00,
            sale_price = 9.20,
            base_price = 5.60,
            margin_pcnt = 25.00,
            discount_pcnt = 8.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 8: Calcium + Vitamin D3
    SELECT id INTO v_product_id FROM product WHERE title = 'Calcium + Vitamin D3';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 80, 6.00, 12.00, 10.20, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 12.00,
            sale_price = 10.20,
            base_price = 6.72,
            margin_pcnt = 30.00,
            discount_pcnt = 15.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 9: Cough Syrup 100ml
    SELECT id INTO v_product_id FROM product WHERE title = 'Cough Syrup 100ml';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 50, 45.00, 85.00, 76.50, 12.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 85.00,
            sale_price = 76.50,
            base_price = 50.40,
            margin_pcnt = 18.00,
            discount_pcnt = 10.00,
            tax_pcnt = 12.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    -- Product 10: Antiseptic Cream 30g
    SELECT id INTO v_product_id FROM product WHERE title = 'Antiseptic Cream 30g';
    IF v_product_id IS NOT NULL THEN
        INSERT INTO purchase_invoice_item (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
        VALUES (v_invoice_id, v_product_id, 70, 25.00, 50.00, 44.00, 18.0, v_user_id);

        UPDATE product_price2 SET
            mrp = 50.00,
            sale_price = 44.00,
            base_price = 29.50,
            margin_pcnt = 20.00,
            discount_pcnt = 12.00,
            tax_pcnt = 18.0
        WHERE product_id = v_product_id AND active = true;
    END IF;

    RAISE NOTICE 'Purchase invoice created with ID: %', v_invoice_id;
END $$;

COMMIT;

-- Display summary
SELECT
    'Pricing test data populated successfully!' as message,
    COUNT(DISTINCT pii.product_id) as products_purchased,
    SUM(pii.qty) as total_quantity,
    ROUND(SUM(pii.qty * pii.ptr_cost)::numeric, 2) as total_purchase_value
FROM purchase_invoice_item pii
JOIN purchase_invoice pi ON pii.invoice_id = pi.id
WHERE pi.invoice_no = 'INV-TEST-001';

-- Show price data
SELECT
    p.title as product,
    pii.ptr_cost as ptr,
    pii.sale_price as recommended_price,
    pii.mrp_cost as mrp,
    pp.sale_price as current_sale_price,
    pp.margin_pcnt as margin,
    pp.discount_pcnt as discount,
    pp.tax_pcnt as tax
FROM product p
JOIN purchase_invoice_item pii ON p.id = pii.product_id
JOIN purchase_invoice pi ON pii.invoice_id = pi.id
JOIN product_price2 pp ON p.id = pp.product_id
WHERE pi.invoice_no = 'INV-TEST-001' AND pp.active = true
ORDER BY p.title
LIMIT 10;
