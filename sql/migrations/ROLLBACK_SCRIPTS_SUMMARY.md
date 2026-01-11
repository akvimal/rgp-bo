# Rollback Scripts Summary

**Date Created:** 2026-01-11
**Status:** Complete
**Total Rollback Scripts:** 27

---

## Overview

This document summarizes all rollback scripts created for the RGP Back Office migration system. Each rollback script corresponds to a forward migration and provides a safe way to revert database changes.

---

## Rollback Scripts by Category

### Infrastructure & Core (002-005)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 002 | 002_rollback.sql | ✅ Exists | Race condition fix |
| 003 | 003_rollback.sql | ✅ Created | HR management tables |
| 004 | 004_rollback.sql | ✅ Created | Test DB setup |
| 005 | 005_rollback.sql | ✅ Created | HR permissions |

**003_rollback.sql:**
- Drops all HR tables: shift, user_shift, attendance (with partitions), leave_type, leave_request, leave_balance, user_score, hr_audit_log
- Note: btree_gist extension kept (may be used by other features)

**004_rollback.sql:**
- Template rollback (review migration to customize)
- Default: No automatic changes

**005_rollback.sql:**
- Removes HR permissions from all roles
- Removes resources: hr, attendance, leave, shift, performance

---

### Purchase Invoice Lifecycle (006)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 006 | 006_rollback.sql | ✅ Exists | Enhanced invoice lifecycle |

**006_rollback.sql:**
- Drops tables: purchase_invoice_document, purchase_effectiveness, purchase_invoice_tax_credit
- Removes columns from: purchase_invoice, purchase_invoice_item, vendor_payment
- Drops all related indexes and constraints
- Includes backup table cleanup

---

### HSN/Tax Management (008-015)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 008 | 008_rollback.sql | ✅ Created | HSN tax master |
| 009 | 009_rollback.sql | ✅ Created | Pharmacy HSN codes (data) |
| 010 | 010_rollback.sql | ✅ Created | Comprehensive 2025 HSN (data) |
| 011 | 011_rollback.sql | ✅ Created | HSN code updates (data) |
| 012 | 012_rollback.sql | ✅ Created | Additional pharmacy codes (data) |
| 013 | 013_rollback.sql | ✅ Created | GST rate updates 2025 (data) |
| 014 | 014_rollback.sql | ✅ Created | HSN permissions |
| 015 | 015_rollback.sql | ✅ Created | ITC tracking fields |

**008_rollback.sql:**
- Drops hsn_tax_master table
- Drops get_hsn_tax_rate() function
- Removes indexes: idx_hsn_tax_active, idx_hsn_tax_dates

**009-013_rollback.sql (Data Migrations):**
- Conservative rollbacks - do NOT delete data by default
- Include commented DELETE statements for manual execution
- Recommended: Restore from backup instead of using DELETE statements

**014_rollback.sql:**
- Removes HSN permissions from roles
- Removes resources: hsn, hsn_master, hsn_tax

**015_rollback.sql:**
- Drops ITC tracking columns from purchase_invoice
- Columns: itc_claimed, itc_claim_date, itc_claim_month, itc_reversal_amount, itc_reversal_reason, itc_status

---

### Pricing Engine (016-017)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 016 | 016_rollback.sql | ✅ Created | Enhance product_price2 |
| 017 | 017_rollback.sql | ✅ Created | Pricing rules engine |

**016_rollback.sql:**
- Drops product_current_price_view
- Removes columns: mrp, base_price, margin_pcnt, discount_pcnt, tax_pcnt, tax_inclusive, pricing_rule_id, calculation_method
- Removes constraints: product_price2_mrp_positive, etc.

**017_rollback.sql:**
- Drops tables: pricing_rule_application, pricing_rule

---

### Sales Intent System (019-022)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 019 | 019_rollback.sql | ✅ Created | Sales intent table |
| 020 | 020_rollback.sql | ✅ Created | Intent items (multi-product) |
| 021 | 021_rollback.sql | ✅ Created | Intent number generation fix |
| 022 | 022_rollback.sql | ✅ Created | Intent permissions |

**019_rollback.sql:**
- Drops sales_intent table
- Drops generate_intent_number() function
- Removes all sales intent indexes

**020_rollback.sql:**
- Drops sales_intent_item table
- Removes summary columns: total_items, total_estimated_cost

**021_rollback.sql:**
- Bug fix rollback (not recommended)
- Default: No changes (keeps fixed version)
- Comment explains restoring buggy version requires manual action

**022_rollback.sql:**
- Removes sales intent permissions from roles
- Removes resources: sales_intent, intent, sales-intent

---

### Multi-Store Architecture (023)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 023 | 023_rollback.sql | ✅ Created | Multi-tenant & multi-store |

**023_rollback.sql:**
- Drops tables: store, tenant, store_inventory, store_reorder_limit
- Drops indexes: idx_tenant_code, idx_tenant_status, idx_store_tenant, etc.

---

### Payroll System (024-029)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 024 | 024_rollback.sql | ✅ Created | Employment types & roles |
| 025 | 025_rollback.sql | ✅ Created | Salary components |
| 026 | 026_rollback.sql | ✅ Created | Salary structure |
| 027 | 027_rollback.sql | ✅ Created | Payroll processing |
| 028 | 028_rollback.sql | ✅ Created | KPI enhancements |
| 029 | 029_rollback.sql | ✅ Created | Payroll permissions |

**024_rollback.sql:**
- Drops tables: role_master, employment_type_master (in dependency order)

**025_rollback.sql:**
- Drops table: salary_component_master

**026_rollback.sql:**
- Drops table: employee_salary_structure

**027_rollback.sql:**
- Drops tables: payment_transaction, payment_request_item, payment_request, payroll_detail, payroll_run
- Drops sequences: payment_request_number_seq, payment_transaction_number_seq

**028_rollback.sql:**
- Drops tables: monthly_kpi_score, kpi_category_master

**029_rollback.sql:**
- Removes payroll permissions from roles (Admin, Store Head, Sales Staff)
- Uses JSONB array element removal

---

### Critical Bug Fixes (033)

| Migration | Rollback Script | Status | Type |
|-----------|-----------------|--------|------|
| 033 | 033_rollback.sql | ✅ Exists | Pack size historical bug fix |

**033_rollback.sql:**
- ⚠️ WARNING: Restores BUGGY behavior
- Drops pack_size column from purchase_invoice_item
- Restores original (buggy) views: inventory_view, product_items_view
- Only use if absolutely necessary for testing

---

## Rollback Execution Guidelines

### Before Running Any Rollback

1. ✅ **BACKUP YOUR DATABASE**
   ```bash
   docker exec rgp-db pg_dump -U rgpapp rgpdb > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. ✅ **Verify Migration Status**
   - Check which migrations are currently applied
   - Ensure you're rolling back in reverse order

3. ✅ **Test on Development First**
   - Never rollback directly in production
   - Test rollback on development database
   - Verify data integrity after rollback

### Rollback Order (Reverse of Forward)

**Full System Rollback (from 033 back to 002):**
```
033 →
029 → 028 → 027 → 026 → 025 → 024 →
023 →
022 → 021 → 020 → 019 →
017 → 016 →
015 → 014 → 013 → 012 → 011 → 010 → 009 → 008 →
006 →
005 → 004 → 003 → 002
```

**Payroll System Only:**
```
029 → 028 → 027 → 026 → 025 → 024
```

**HSN/Tax System Only:**
```
015 → 014 → 013 → 012 → 011 → 010 → 009 → 008
```

### Executing Rollbacks

```bash
# Single rollback
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/033_rollback.sql

# Check results
docker exec rgp-db psql -U rgpapp -d rgpdb -c "\dt"

# Verify specific table dropped
docker exec rgp-db psql -U rgpapp -d rgpdb -c "\d purchase_invoice_item"
```

---

## Rollback Categories & Characteristics

### Structure-Changing Rollbacks (Safe)
Tables and columns can be dropped cleanly:
- 003, 008, 017, 019, 020, 023, 024-028

### Data Rollbacks (Use with Caution)
Only modify/delete data:
- 009, 010, 011, 012, 013
- Default: No automatic data deletion
- Recommendation: Restore from backup instead

### Permission Rollbacks (Reversible)
Modify role permissions:
- 005, 014, 022, 029
- Safe to run, easily reversible

### Bug Fix Rollbacks (Not Recommended)
Restore buggy behavior:
- 021, 033
- Only use for testing/debugging

---

## Special Considerations

### 1. Data Migration Rollbacks (009-013)

These rollbacks are **intentionally conservative**:
- Do NOT delete data by default
- Include commented DELETE statements
- Require manual review before execution
- **Recommended:** Restore from backup instead

**Why?**
- Data may have been modified after migration
- Multiple migrations may have added to the same tables
- Risk of deleting production data

### 2. Bug Fix Rollbacks (021, 033)

**021_rollback.sql:**
- Fixes generate_intent_number() function
- Rollback would restore buggy version
- Not recommended unless testing

**033_rollback.sql:**
- Fixes critical pack size historical data bug
- Rollback restores BUGGY behavior
- **WARNING:** Only use for testing!

### 3. Permission Rollbacks (005, 014, 022, 029)

Safe to run but consider:
- Will remove access for users
- May break frontend features
- Can be easily re-run if needed

---

## Verification After Rollback

After running any rollback, verify:

```sql
-- Check table exists/dropped
\dt table_name

-- Check column exists/dropped
\d table_name

-- Check view exists/dropped
\dv view_name

-- Check function exists/dropped
\df function_name

-- Check permissions
SELECT id, name, permissions
FROM app_role
WHERE id IN (1, 2, 3);
```

---

## Troubleshooting

### Rollback Fails with Foreign Key Error

**Problem:** Cannot drop table due to foreign key dependencies

**Solution:**
```sql
-- Use CASCADE to drop dependencies
DROP TABLE table_name CASCADE;
```

All rollback scripts already use CASCADE where appropriate.

### Rollback Partially Completes

**Problem:** Rollback script fails midway

**Solution:**
1. Check error message
2. Fix the issue
3. Re-run the rollback (scripts are idempotent)
4. Or restore from backup

### Data Already Modified

**Problem:** Cannot rollback data migration because data changed

**Solution:**
- Restore from backup taken before migration
- Or manually correct the data
- Do NOT rely on DELETE statements for production data

---

## Missing Rollbacks

**None!** All 27 forward migrations now have corresponding rollback scripts.

**Coverage:**
- Infrastructure: 4/4 ✅
- Invoice: 1/1 ✅
- HSN/Tax: 8/8 ✅
- Pricing: 2/2 ✅
- Sales Intent: 4/4 ✅
- Multi-Store: 1/1 ✅
- Payroll: 6/6 ✅
- Bug Fixes: 1/1 ✅

---

## Best Practices

1. **Always Backup First**
   - Before ANY rollback
   - Automate backups if possible

2. **Test in Development**
   - Never test rollbacks in production
   - Use development/staging environment

3. **Roll Back in Reverse Order**
   - Follow dependency chain
   - Don't skip migrations

4. **Verify Each Step**
   - Check after each rollback
   - Ensure expected state

5. **Document Rollbacks**
   - Record when and why
   - Note any issues encountered

6. **For Data Migrations**
   - Prefer backup restoration
   - Avoid DELETE statements in production

---

## Quick Reference

### Find Rollback for Migration
```bash
# List all rollback scripts
ls sql/migrations/*_rollback.sql

# Find specific rollback
ls sql/migrations/024_rollback.sql
```

### Check if Migration Has Rollback
```bash
# Check existence
[ -f "sql/migrations/024_rollback.sql" ] && echo "Exists" || echo "Missing"
```

### Count Rollback Scripts
```bash
ls sql/migrations/*_rollback.sql | wc -l
# Should be: 27
```

---

## Support

For issues with rollback scripts:

1. **Check Verification Output**
   - Each rollback includes verification queries
   - Read the NOTICE/WARNING messages

2. **Review Migration**
   - Read the forward migration
   - Understand what it creates/modifies

3. **Consult Documentation**
   - MIGRATION_MAP.md - Migration dependencies
   - RENUMBERING_COMPLETE.md - Migration overview

4. **Test Thoroughly**
   - Development database first
   - Verify data integrity
   - Check application functionality

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Complete - All rollbacks created
