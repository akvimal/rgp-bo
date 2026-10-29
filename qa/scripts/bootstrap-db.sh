#!/usr/bin/env bash
# (Re)load the branch schema + demo data into the running postgres container,
# in dependency order. Safe to re-run: it drops and recreates the public schema
# first. For a full teardown incl. the volume use `npm run stack:up`.
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"

wait_for_pg

DDL_BASE=(001_sequences 002_tables 003_views 004_functions 005_seed)
MIGRATIONS=(
  008_delivery_phase1 009_delivery_partners 010_purchase_payables_phase1
  011_vendor_payment_audit_columns 012_purchase_planning_phase1
  013_purchase_order_approval_and_settings 014_store_shift_cash_handling
  015_store_cash_threshold 016_user_store_assignments 017_store_crud
  018_sale_acting_user 019_stock_permissions_and_audit 020_business_master
  021_fk_indexes_and_unique_fixes 022_user_business_scope 023_nav_permission_paths
  024_shift_denominations 025_shift_permissions 026_payables_cleanup
  027_gst_data_model 028_gst_reconciliation
  029_store_stock 030_product_bin_location 031_stock_adjustment_reason_code
  032_cash_deposit_reference 033_cash_expense_category 034_shift_checklist
  035_stock_count 036_telegram_notifications 037_notifications_permission 038_audit_event 039_staff_sales_permission 040_grievances 041_discrepancies_permission 042_refill_followup 043_vendor_master 044_vendor_block 045_invoice_hold 046_invoice_gstin_backfill 047_business_profile_permission 048_store_licenses 049_sales_staff_purchase_request 050_customer_alt_mobile 051_customer_delete_permission 052_sales_staff_refills 053_digital_payment_reference 054_staff_credit 055_hr_module 056_customer_store_credit 057_expenses 058_hr_staff_without_login 059_hr_work_schedule 060_hr_kpi_sources 061_customer_inquiries 062_shift_handover_digital 063_sale_supply_months 064_vendor_issues 065_stock_audit 066_sale_suggestions 067_my_hr 068_payment_reconciliation 069_payment_statement 070_sales_staff_payment_recon 071_invoice_printed_total 072_invoice_cash_discount 073_store_transfers_path 074_store_profile 075_approval_mode 076_business_modules 077_account_kinds 078_staffing_preset 079_platform_entitlement 080_platform_counter 081_pharmacist_registration 082_store_type 083_deposit_schedule 084_alerts 085_request_unlisted_product 086_product_min_stock 087_setting_value_longer 088_shift_checklist 089_shift_checklist_log 090_return_rules 091_price_variance 092_challan_receipts 093_unit_changed_reason 094_price_view_gst_basis 095_price_policy 096_sale_gst_basis 097_sale_mrp_guard 098_usual_discount 099_outage_kit 100_stock_count_escalation 101_weekly_review 102_stock_audit_records 103_finance_bank 104_pharmacy_drug_register 105_returns_switch 106_gst_rate_changes 107_gst_registration 108_gst_filing_months 109_dashboard_path_all_roles 110_config_override 111_compliance_register 112_recognition 113_metric_target 114_dashboard_setup_permission 115_hr_position
)

echo "[bootstrap] reset public schema"
psql_c -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;
           GRANT ALL ON SCHEMA public TO ${POSTGRES_USER}; GRANT ALL ON SCHEMA public TO public;" >/dev/null

echo "[bootstrap] base DDL (001-005)"
for f in "${DDL_BASE[@]}"; do echo "  - ddl/$f.sql"; psql_c -f "//sql/ddl/$f.sql" >/dev/null; done

echo "[bootstrap] migrations (008-022)"
for f in "${MIGRATIONS[@]}"; do echo "  - migrations/$f.sql"; psql_c -f "//sql/migrations/$f.sql" >/dev/null; done

echo "[bootstrap] dev demo data (006_dev_test_data.sql)"
psql_c -f "//sql/ddl/006_dev_test_data.sql" >/dev/null

echo "[bootstrap] qa fixups"
# 006 re-inserts app_user AFTER migration 022's backfill -> Business Head accounts
# lose business_id. Re-link (022 intent).
psql_c -c "UPDATE app_user SET business_id = (SELECT id FROM business ORDER BY id LIMIT 1) WHERE role_id = 1 AND business_id IS NULL;" >/dev/null
# the sample bills of the suite use synthetic prices (far above the sample MRPs); the server's MRP guard would refuse them. The suite runs with
# the guard off, and price-policy.spec.ts (POLICY-5) switches it on for its own check and back off.
psql_c -c "UPDATE app_setting SET setting_value = 'off' WHERE setting_key = 'sale_mrp_guard';" >/dev/null
# the sample bills of the suite sell scheduled drugs without a patient or prescriber; the drug register requirement is off for the suite, and drug-register.spec.ts
# switches it on for its own checks and back off.
psql_c -c "UPDATE app_setting SET setting_value = '' WHERE setting_key = 'schedule_register_required';" >/dev/null
# 005_seed inserts app_role with explicit ids 1-4 without advancing its sequence,
# so the first API-created role collides on the pk. Resync every serial sequence.
psql_c >/dev/null <<'SQL'
DO $$
DECLARE r RECORD; mx BIGINT; seq TEXT;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped
  LOOP
    seq := pg_get_serial_sequence('public.'||quote_ident(r.tbl), r.col);
    IF seq IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM public.%I', r.col, r.tbl) INTO mx;
    EXECUTE format('SELECT setval(%L, GREATEST(%s,1), %L)', seq, mx, mx > 0);
  END LOOP;
END $$;
SQL

echo "[bootstrap] pg_stat_statements extension"
psql_c -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" >/dev/null

echo "[bootstrap] schema verification"
FAILS="$(psql_c -tA -c "
  SELECT count(*) FROM (VALUES
    (to_regclass('public.stores')), (to_regclass('public.store_shifts')),
    (to_regclass('public.store_shift_templates')), (to_regclass('public.store_cash_accounts')),
    (to_regclass('public.user_stores'))) v(x) WHERE x IS NULL;" | tr -d '[:space:]')"
COLS="$(psql_c -tA -c "
  SELECT count(*) FROM (VALUES
    ('sale','acting_user_id'),('sale','shift_id'),('app_user','business_id'),
    ('business','active'),('stores','deposit_threshold')) t(tb,cl)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=t.tb AND column_name=t.cl);" | tr -d '[:space:]')"
if [[ "$FAILS" != "0" || "$COLS" != "0" ]]; then
  echo "[bootstrap] SCHEMA VERIFICATION FAILED (missing tables: $FAILS, columns: $COLS)" >&2; exit 1
fi

USERS="$(psql_c -tA -c "SELECT count(*) FROM app_user;" | tr -d '[:space:]')"
BIZ="$(psql_c -tA -c "SELECT count(*) FROM business;" | tr -d '[:space:]')"
echo "[bootstrap] OK - schema verified. app_user=$USERS  business=$BIZ"
