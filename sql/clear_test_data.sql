-- =====================================================
-- Clear All Test Data Script
-- =====================================================
-- This script removes all test/transactional data while preserving:
-- 1. Database schema (tables, functions, sequences, views)
-- 2. Essential master data (roles, admin user)
-- 3. HSN tax master data (reference data)
-- =====================================================

DO $$
DECLARE
    tbl_name TEXT;
    tables_to_clear TEXT[] := ARRAY[
        -- Sales and Returns
        'sale_return_item',
        'sale_deliveries',
        'sale_item',
        'sale',
        'sales_meta',

        -- Sales Intent
        'sales_intent_item',
        'sales_intent',

        -- Purchase Operations
        'purchase_invoice_item',
        'purchase_invoice_document',
        'purchase_invoice_tax_credit',
        'purchase_invoice',
        'purchase_order',
        'purchase_request',
        'purchase_effectiveness',

        -- Vendor Operations
        'vendor_payment',
        'vendor_pricelist',

        -- Payment Requests
        'payment_request_item',
        'payment_request',
        'payment_transaction',

        -- Product History and Movements
        'product_qtychange',
        'product_clearance',
        'batch_movement_log',
        'product_batch',
        'pricing_rule_application',
        'stock_variance_log',
        'expiry_status_update_log',
        'expiry_check_log',

        -- Product Pricing and Products
        'product_price2',
        'product_price',
        'product_store_config',
        'product',

        -- Pricing Rules
        'pricing_rule',

        -- Customer Data
        'customer_transaction',
        'customer_documents',
        'customer',

        -- Vendor Data
        'vendor',

        -- Documents
        'documents',

        -- Store and Business Data
        'store',
        'business_location',
        'business',

        -- Attendance (including partitions)
        'attendance_2026_03',
        'attendance_2026_02',
        'attendance_2026_01',
        'attendance_2025_12',
        'attendance_2025_11',
        'attendance',

        -- Leave Management
        'leave_balance',
        'leave_request',
        'leave_type',

        -- Shift Management
        'user_shift',
        'shift',

        -- Benefits and Policies
        'benefit_claim',
        'employee_benefit_enrollment',
        'hr_policy_acknowledgment',
        'policy_eligibility_rule',
        'benefit_policy',
        'benefit_master',
        'hr_policy_master',

        -- KPI and Scoring
        'monthly_kpi_score',
        'user_score',

        -- Payroll Data
        'payroll_detail',
        'payroll_run',
        'employee_salary_structure',

        -- Monitoring/Audit Data
        'audit_log',
        'api_usage_log',
        'query_performance_log',
        'system_performance_log',

        -- Session/Chat Data
        'accounts',
        'langchain_chat_histories',

        -- Password Reset Tokens
        'password_reset_token'
    ];
BEGIN
    -- Disable triggers temporarily for faster deletion
    SET session_replication_role = replica;

    -- Truncate each table if it exists
    FOREACH tbl_name IN ARRAY tables_to_clear
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables t
                   WHERE t.table_schema = 'public'
                   AND t.table_name = tbl_name) THEN
            EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl_name);
            RAISE NOTICE 'Cleared table: %', tbl_name;
        ELSE
            RAISE NOTICE 'Skipped (not found): %', tbl_name;
        END IF;
    END LOOP;

    -- Clear user data (except admin)
    DELETE FROM app_user WHERE email != 'admin@rgp.com';
    RAISE NOTICE 'Deleted non-admin users';

    -- Clear user role assignments
    IF EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_name = 'user_role_assignment') THEN
        DELETE FROM user_role_assignment WHERE user_id NOT IN (SELECT id FROM app_user WHERE email = 'admin@rgp.com');
        RAISE NOTICE 'Cleared user role assignments';
    END IF;

    -- Reset sequences that exist
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'billno') THEN
        ALTER SEQUENCE billno RESTART WITH 1;
        RAISE NOTICE 'Reset billno sequence';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'custorderno') THEN
        ALTER SEQUENCE custorderno RESTART WITH 1;
        RAISE NOTICE 'Reset custorderno sequence';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'intentno') THEN
        ALTER SEQUENCE intentno RESTART WITH 1;
        RAISE NOTICE 'Reset intentno sequence';
    END IF;

    -- Re-enable triggers
    SET session_replication_role = DEFAULT;

    RAISE NOTICE 'Test data cleared successfully!';
END $$;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check counts after clearing
SELECT
  'Products' as entity, COUNT(*) as count FROM product
UNION ALL
SELECT 'Customers', COUNT(*) FROM customer
UNION ALL
SELECT 'Vendors', COUNT(*) FROM vendor
UNION ALL
SELECT 'Sales', COUNT(*) FROM sale
UNION ALL
SELECT 'Purchase Invoices', COUNT(*) FROM purchase_invoice
UNION ALL
SELECT 'Users', COUNT(*) FROM app_user
UNION ALL
SELECT 'Roles', COUNT(*) FROM app_role
UNION ALL
SELECT 'HSN Tax Master', COUNT(*) FROM hsn_tax_master;

-- Display remaining users
SELECT id, full_name, email, location, active FROM app_user ORDER BY id;

-- Display roles
SELECT id, name, locked, active FROM app_role ORDER BY id;
