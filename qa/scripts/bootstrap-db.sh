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
  035_stock_count
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
