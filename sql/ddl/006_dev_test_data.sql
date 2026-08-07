TRUNCATE TABLE
    public.sale_return_item,
    public.sale_item,
    public.sale_deliveries,
    public.sale,
    public.vendor_payment,
    public.purchase_invoice_item,
    public.purchase_invoice,
    public.purchase_request,
    public.purchase_order,
    public.store_cash_accounts,
    public.store_shifts,
    public.store_shift_templates,
    public.user_stores,
    public.delivery_partner,
    public.product,
    public.vendor,
    public.customer,
    public.stores,
    public.business,
    public.app_user,
    public.sales_meta
RESTART IDENTITY CASCADE;

INSERT INTO public.business (id, "name")
VALUES
    (1, 'RGP Pharmacy');

INSERT INTO public.stores (id, location, business_id, deposit_threshold, active, archive)
VALUES
    (1, 'Main Store', 1, 10000, true, false);

INSERT INTO public.app_user (
    id, email, phone, active, "location", full_name, archive,
    created_by, updated_by, "password", role_id
)
VALUES
    (5, 'siteadmin@local.test', '9999999990', true, 'Local Dev', 'Site Admin', false, 1, 1, '$2b$10$VdhRjllq5P5zBeh3zi51Y.oYNI5CXk2Mu5u0eQs3HvVhM7wxTPQTS', 4),
    (1, 'businesshead@local.test', '9999999999', true, 'Local Dev', 'Business Head', false, 1, 1, '$2b$10$VdhRjllq5P5zBeh3zi51Y.oYNI5CXk2Mu5u0eQs3HvVhM7wxTPQTS', 1),
    (2, 'storehead@local.test', '9999999998', true, 'Local Dev', 'Store Head', false, 1, 1, '$2b$10$VdhRjllq5P5zBeh3zi51Y.oYNI5CXk2Mu5u0eQs3HvVhM7wxTPQTS', 3),
    (3, 'sales1@local.test', '9999999997', true, 'Local Dev', 'Sale Staff One', false, 1, 1, '$2b$10$VdhRjllq5P5zBeh3zi51Y.oYNI5CXk2Mu5u0eQs3HvVhM7wxTPQTS', 2),
    (4, 'sales2@local.test', '9999999996', true, 'Local Dev', 'Sale Staff Two', false, 1, 1, '$2b$10$VdhRjllq5P5zBeh3zi51Y.oYNI5CXk2Mu5u0eQs3HvVhM7wxTPQTS', 2);

INSERT INTO public.user_stores (
    user_id, store_id, is_primary, created_by, updated_by, active, archive
)
VALUES
    (2, 1, true, 1, 1, true, false),
    (3, 1, true, 1, 1, true, false),
    (4, 1, true, 1, 1, true, false);

INSERT INTO public.customer (
    id, "name", mobile, email, address, active, archive, created_by, updated_by
)
VALUES
    (1, 'Aarav Kumar', '9000000001', 'aarav@example.com', '12 Lake View Road', true, false, 1, 1),
    (2, 'Meera Nair', '9000000002', 'meera@example.com', '44 Park Street', true, false, 1, 1),
    (3, 'Rohan Shah', '9000000003', 'rohan@example.com', '9 Hill Avenue', true, false, 1, 1),
    (4, 'Priya Iyer', '9000000004', 'priya@example.com', '18 Green Street', true, false, 1, 1);

INSERT INTO public.vendor (
    id, business_name, contact_name, contact_phone, address, comments,
    active, archive, created_by, updated_by
)
VALUES
    (101, 'MediSupply Distributors', 'Anita Rao', '9002001001', 'Warehouse Road, City Center', 'Primary wholesaler', true, false, 1, 1),
    (102, 'HealthBridge Pharma', 'Kiran Das', '9002001002', 'Industrial Estate, North Zone', 'Secondary supplier', true, false, 1, 1),
    (103, 'CityCare Pharma', 'Ramesh B', '9002001003', 'North Market, City Center', 'Weekend replenishment source', true, false, 1, 1);

INSERT INTO public.delivery_partner (
    id, "name", contact_name, contact_phone, address, "comments", active, archive, created_by, updated_by
)
VALUES
    (1, 'Delhivery', 'Ops Desk', '9001001001', 'City hub', 'Primary courier partner', true, false, 1, 1),
    (2, 'BlueDart', 'Support Desk', '9001001002', 'Regional hub', 'Secondary courier partner', true, false, 1, 1);

INSERT INTO public.product (
    id, title, active, archive, created_by, updated_by, pack, tax_pcnt, category, brand, more_props
)
VALUES
    (201, 'Paracetamol 650', true, false, 1, 1, 10, 12.0, 'Tablet', 'MediCare', NULL),
    (202, 'Vitamin C 500', true, false, 1, 1, 15, 5.0, 'Supplement', 'NutriPlus', NULL),
    (203, 'Cough Syrup 100ml', true, false, 1, 1, 1, 12.0, 'Syrup', 'Respira', '{"purchaseApprovalRequired": true, "purchaseApprovalQtyThreshold": 2}'::json),
    (204, 'ORS Powder', true, false, 1, 1, 20, 5.0, 'Powder', 'HydraPlus', NULL);

INSERT INTO public.purchase_order (
    id, vendor_id, status, comments, active, archive, created_by, updated_by,
    po_number, expected_date, source_summary, approval_status, approval_reason,
    approval_requested_by, approval_requested_at, approved_by, approved_at,
    rejected_by, rejected_at, rejection_reason
)
VALUES
    (3001, 102, 'SUBMITTED', 'Cough syrup replenishment', true, false, 1, 1,
     'PO-3001', CURRENT_DATE + INTERVAL '3 days', 'Customer request and low stock', 'APPROVED', 'Approved for emergency restock',
     2, CURRENT_TIMESTAMP - INTERVAL '1 day', 1, CURRENT_TIMESTAMP - INTERVAL '1 day',
     NULL, NULL, NULL),
    (3002, 103, 'SUBMITTED', 'ORS stocking order', true, false, 1, 1,
     'PO-3002', CURRENT_DATE + INTERVAL '5 days', 'Weekend demand forecast', 'APPROVED', 'Approved by business head',
     2, CURRENT_TIMESTAMP - INTERVAL '1 day', 1, CURRENT_TIMESTAMP - INTERVAL '1 day',
     NULL, NULL, NULL);

INSERT INTO public.purchase_request (
    id, product_id, vendor_id, request_type, source, priority, qty, suggested_qty,
    ordered_qty, fulfilled_qty, order_id, status, customer_name, customer_phone,
    needed_by, source_ref, comments, notes, active, archive, created_by, updated_by
)
VALUES
    (10001, 203, 102, 'Ad Hoc', 'Customer', 'Urgent', 2, 0, 0, 0, NULL, 'Open',
     'Nisha Patel', '9003001001', CURRENT_DATE + INTERVAL '1 day', 'Walk-in request',
     'Requested for next-day availability', 'Notify customer when stock arrives', true, false, 3, 3),
    (10002, 204, 103, 'Refill', 'Staff', 'Normal', 8, 8, 8, 0, 3002, 'Ordered',
     NULL, NULL, CURRENT_DATE + INTERVAL '4 day', 'Shelf refill',
     'Replenish before weekend', 'Linked to PO-3002', true, false, 2, 2);

INSERT INTO public.purchase_invoice (
    id, invoice_no, invoice_date, due_date, vendor_id, active, status, payment_status, gr_no,
    archive, created_by, updated_by, purchase_order_id, comments, reference_no, notes, total
)
VALUES
    (4001, 'INV-1001', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '2 days', 101, true, 'COMPLETE', 'Paid', 'GRN-1001', false, 2, 2, NULL,
     'Monthly replenishment', 'MED-1001', 'Fully settled invoice for local testing', 2200.00),
    (4002, 'INV-1002', CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '4 days', 102, true, 'COMPLETE', 'Part Paid', 'GRN-1002', false, 2, 2, '3001',
     'Emergency cough syrup order', 'HB-1002', 'Linked to approved PO-3001', 3000.00),
    (4003, 'INV-1003', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '1 day', 103, true, 'COMPLETE', 'Overdue', 'GRN-1003', false, 2, 2, '3002',
     'Weekend replenishment', 'CC-1003', 'Unpaid overdue invoice for outstanding checks', 2520.00);

INSERT INTO public.purchase_invoice_item (
    id, invoice_id, product_id, batch, exp_date, ptr_cost, mrp_cost, disc_pcnt, tax_pcnt,
    qty, comments, sale_price, status, active, archive, created_by, updated_by, total,
    ptr_value, mfr_date, free_qty
)
VALUES
    (5001, 4001, 201, 'PCM650-A1', CURRENT_DATE + INTERVAL '420 days', 10.00, 15.00, 0.0, 12.0, 100, 'Invoice 1001 line 1', 12.00, 'VERIFIED', true, false, 2, 2, 1000.00, 10.00, CURRENT_DATE - INTERVAL '40 days', 0),
    (5002, 4001, 202, 'VITC500-A1', CURRENT_DATE + INTERVAL '365 days', 15.00, 20.00, 0.0, 5.0, 80, 'Invoice 1001 line 2', 18.00, 'VERIFIED', true, false, 2, 2, 1200.00, 15.00, CURRENT_DATE - INTERVAL '35 days', 0),
    (5003, 4002, 203, 'COUGH100-B1', CURRENT_DATE + INTERVAL '300 days', 45.00, 60.00, 0.0, 12.0, 30, 'Invoice 1002 line 1', 55.00, 'VERIFIED', true, false, 2, 2, 1350.00, 45.00, CURRENT_DATE - INTERVAL '28 days', 0),
    (5004, 4002, 204, 'ORS-B1', CURRENT_DATE + INTERVAL '340 days', 11.00, 14.00, 0.0, 5.0, 150, 'Invoice 1002 line 2', 13.00, 'VERIFIED', true, false, 2, 2, 1650.00, 11.00, CURRENT_DATE - INTERVAL '28 days', 0),
    (5005, 4003, 201, 'PCM650-C1', CURRENT_DATE + INTERVAL '380 days', 10.00, 15.00, 0.0, 12.0, 60, 'Invoice 1003 line 1', 12.00, 'VERIFIED', true, false, 2, 2, 600.00, 10.00, CURRENT_DATE - INTERVAL '26 days', 0),
    (5006, 4003, 203, 'COUGH100-C1', CURRENT_DATE + INTERVAL '290 days', 48.00, 65.00, 0.0, 12.0, 40, 'Invoice 1003 line 2', 56.00, 'VERIFIED', true, false, 2, 2, 1920.00, 48.00, CURRENT_DATE - INTERVAL '26 days', 0);

INSERT INTO public.vendor_payment (
    id, vendor_id, invoice_id, pay_date, amount, pay_mode, trans_ref,
    communication_status, communication_channel, communicated_at, acknowledged_at,
    acknowledgement_reference, remarks, active, archive, created_by, updated_by
)
VALUES
    (6001, 101, 4001, CURRENT_DATE - INTERVAL '2 days', 2200.00, 'Transfer', 'UTR1001A',
     'Acknowledged', 'WhatsApp', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day 20 hours',
     'INV-1001 confirmed', 'Full payment acknowledged', true, false, 2, 2),
    (6002, 102, 4002, CURRENT_DATE - INTERVAL '1 day', 900.00, 'UPI', 'UTR1002A',
     'Sent', 'WhatsApp', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL,
     NULL, 'Part payment sent for PO-3001', true, false, 2, 2);

INSERT INTO public.store_shift_templates (
    id, store_id, name, start_time, end_time, deposit_threshold, assigned_user_id, active, created_by, updated_by
)
VALUES
    (1101, 1, 'Morning', '09:30', '21:30', 10000, 3, true, 2, 2),
    (1102, 1, 'Weekend', '10:00', '18:00', 10000, 4, true, 2, 2);

INSERT INTO public.store_shifts (
    id, store_id, template_id, shift_date, name, start_time, end_time, status, opening_cash,
    expected_cash, counted_cash, variance, deposit_threshold, opened_on, closed_on, notes,
    assigned_user_id, opened_by, closed_by, created_by, updated_by
)
VALUES
    (1201, 1, 1101, CURRENT_DATE, 'Morning', '09:30', '21:30', 'OPEN', 2000,
     2540, NULL, NULL, 10000, CURRENT_TIMESTAMP - INTERVAL '6 hours', NULL, 'Seeded open shift for local testing',
     3, 2, NULL, 2, 2);

INSERT INTO public.store_cash_accounts (
    id, trans_date, category, description, deposit, withdraw, store_id, shift_id
)
VALUES
    (1301, CURRENT_DATE, 'OPENING', 'Opening cash', 2000, 0, 1, 1201),
    (1302, CURRENT_DATE, 'SALE', 'Sale 1001 cash', 540, 0, 1, 1201);

INSERT INTO public.sale (
    id, bill_date, customer_id, status, active, archive, created_by, updated_by,
    total, expreturn_days, bill_no, order_no, order_date, digi_method, digi_refno,
    digi_amount, cash_amount, order_type, delivery_type, doc_pending, acting_user_id, shift_id
)
VALUES
    (7001, CURRENT_TIMESTAMP - INTERVAL '6 hours', 1, 'COMPLETE', true, false, 3, 3, 540.0, 4, 1001, 5001, CURRENT_DATE, NULL, NULL, 0.0, 540.0, 'Walk-in', 'Counter', false, 3, 1201),
    (7002, CURRENT_TIMESTAMP - INTERVAL '4 hours', 2, 'COMPLETE', true, false, 4, 4, 780.0, 4, 1002, 5002, CURRENT_DATE, 'UPI', 'UPI1002', 780.0, 0.0, 'Phone', 'Delivery', false, 4, NULL),
    (7003, CURRENT_TIMESTAMP - INTERVAL '1 hour', 3, 'PENDING', true, false, 3, 3, 300.0, 4, 1003, 5003, CURRENT_DATE, NULL, NULL, 0.0, 0.0, 'Whatsapp', 'Counter', false, 3, 1201);

INSERT INTO public.sale_item (
    id, sale_id, purchase_item_id, product_id, batch, exp_date, price, mrp_cost, tax_pcnt,
    qty, total, status, active, archive, created_by, updated_by
)
VALUES
    (8001, 7001, 5001, 201, 'S1001-A', CURRENT_DATE + INTERVAL '6 months', 540.0, 600.0, 0, 1, 540.0, 'Complete', true, false, 3, 3),
    (8002, 7002, 5003, 203, 'S1002-A', CURRENT_DATE + INTERVAL '6 months', 400.0, 450.0, 0, 1, 400.0, 'Complete', true, false, 4, 4),
    (8003, 7002, 5004, 204, 'S1002-B', CURRENT_DATE + INTERVAL '6 months', 380.0, 420.0, 0, 1, 380.0, 'Complete', true, false, 4, 4),
    (8004, 7003, 5002, 202, 'S1003-A', CURRENT_DATE + INTERVAL '6 months', 150.0, 180.0, 0, 2, 300.0, 'Pending', true, false, 3, 3);

INSERT INTO public.sale_deliveries (
    id, "saleId", booked_date, booked_by, receiver_name, receiver_phone, receiver_address,
    delivery_date, delivery_by, delivery_method, courier_partner, delivered_at, confirmed,
    confirmed_by, confirmed_at, charges, actual_cost, status, payment_mode,
    collection_status, failure_reason, "comments", active, archive, created_by, updated_by
)
VALUES
    (9001, 7002, CURRENT_DATE, 4, 'Meera Nair', '9000000002', '44 Park Street',
     CURRENT_DATE, 'Delhivery', 'Courier', 'Delhivery', CURRENT_TIMESTAMP - INTERVAL '90 minutes',
     true, 'Meera Nair', CURRENT_TIMESTAMP - INTERVAL '80 minutes', 60.0, 48.0, 'Delivered',
     'Prepaid', 'Collected', NULL, 'Handed to customer', true, false, 4, 4);

SELECT setval('public.business_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.business), 1), true);
SELECT setval('public.stores_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.stores), 1), true);
SELECT setval('public.app_user_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.app_user), 1), true);
SELECT setval('public.customer_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.customer), 1), true);
SELECT setval('public.vendor_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.vendor), 1), true);
SELECT setval('public.delivery_partner_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.delivery_partner), 1), true);
SELECT setval('public.product_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.product), 1), true);
SELECT setval('public.purchase_order_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.purchase_order), 1), true);
SELECT setval('public.purchase_request_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.purchase_request), 1), true);
SELECT setval('public.purchase_invoice_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.purchase_invoice), 1), true);
SELECT setval('public.purchase_invoice_item_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.purchase_invoice_item), 1), true);
SELECT setval('public.vendor_payment_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.vendor_payment), 1), true);
SELECT setval('public.store_shift_templates_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.store_shift_templates), 1), true);
SELECT setval('public.store_shifts_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.store_shifts), 1), true);
SELECT setval('public.store_cash_accounts_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.store_cash_accounts), 1), true);
SELECT setval('public.sale_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.sale), 1), true);
SELECT setval('public.sale_item_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.sale_item), 1), true);
SELECT setval('public.sale_deliveries_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.sale_deliveries), 1), true);

WITH fy AS (
    SELECT DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day' AS fiscal_year_start
)
INSERT INTO public.sales_meta (id, fiscal_year_start, last_bill_no)
SELECT 1, fiscal_year_start, 1003
FROM fy;

SELECT setval('public.sales_meta_id_seq1', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.sales_meta), 1), true);
