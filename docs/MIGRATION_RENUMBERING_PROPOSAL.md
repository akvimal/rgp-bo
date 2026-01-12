# Migration Renumbering Proposal

**Date:** 2026-01-11
**Status:** DRAFT - Awaiting Approval
**Priority:** CRITICAL - Required before any migration execution

---

## Executive Summary

This proposal provides a comprehensive renumbering scheme for all 34 SQL migration files to resolve duplicate migration numbers and establish a clear, sequential migration path.

**Current State:** 21 migration number conflicts across 31 forward migrations
**Proposed State:** Clean sequential numbering 001-040 with no conflicts

---

## Renumbering Strategy

### Approach: Chronological + Feature-Based Grouping

1. **Preserve existing clean migrations** (002-005)
2. **Group related features together** for logical progression
3. **Separate production migrations from test data**
4. **Clearly mark deprecated/replaced migrations**
5. **Ensure all dependencies are satisfied in sequence**

### Migration Categories

- **Infrastructure & Core** (002-005): Race conditions, HR basics, test DB setup
- **Purchase Invoice Lifecycle** (006-007): Enhanced invoice management
- **HSN/Tax Management** (008-015): GST, HSN codes, tax tracking, ITC
- **Pricing Engine** (016-018): Product pricing, rules engine
- **Sales Intent System** (019-021): Customer requests, multi-product support
- **Multi-Store Architecture** (022): Tenant and store management
- **Payroll System** (023-032): Employment, salary, payroll processing
- **Bug Fixes** (033-034): Critical production fixes
- **Test Data & Utilities** (090-095): Sample data, cleanup scripts

---

## Complete Renumbering Scheme

### Phase 1: Infrastructure & Core (002-005) ✅ No Changes

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 002_fix_bill_number_race_condition.sql | 002 | ✅ KEEP | Race condition fix with row-level locking |
| 002_rollback.sql | 002_rollback | ✅ KEEP | Rollback for migration 002 |
| 003_hr_management_tables.sql | 003 | ✅ KEEP | HR management tables (shift, attendance, leave) |
| 004_setup_test_db.sql | 004 | ✅ KEEP | Test database setup |
| 005_update_hr_permissions.sql | 005 | ✅ KEEP | HR permissions update |

---

### Phase 2: Purchase Invoice Lifecycle (006-007)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 006_enhanced_invoice_lifecycle.sql | 006 | ✅ KEEP | Enhanced invoice lifecycle with OCR, tax credit tracking |
| 006_rollback.sql | 006_rollback | ✅ KEEP | Rollback for enhanced invoice lifecycle |
| - | 007 | 🆕 NEW | (Reserved for future invoice enhancements) |

**Conflicts Resolved:**
- ❌ REMOVE: `006_employment_type_role_masters.sql` → Moved to 023
- ❌ REMOVE: `006-010_flexible_payroll_system_complete.sql` → Replaced by 023-032

---

### Phase 3: HSN/Tax Management (008-015)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 007_create_hsn_tax_master.sql | 008 | ✏️ RENAME | Create HSN tax master table |
| 008_populate_pharmacy_hsn_codes.sql | 009 | ✏️ RENAME | Populate pharmacy HSN codes (initial data) |
| 013_comprehensive_hsn_tax_master_2025.sql | 010 | ✏️ RENAME | Comprehensive HSN tax master for 2025 |
| 014_update_hsn_codes_detailed.sql | 011 | ✏️ RENAME | Update HSN codes with detailed classification |
| 015_populate_pharmacy_hsn_codes.sql | 012 | ✏️ RENAME | Additional pharmacy HSN codes |
| 012_update_medicine_gst_rates_2025.sql | 013 | ✏️ RENAME | Update medicine GST rates for 2025 |
| 011_add_hsn_permissions.sql | 014 | ✏️ RENAME | Add HSN management permissions |
| 014_add_itc_tracking_fields.sql | 015 | ✏️ RENAME | Add ITC (Input Tax Credit) tracking fields |

**Dependency Chain:** 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015

**Conflicts Resolved:**
- ❌ REMOVE: `007_salary_component_master.sql` → Moved to 024

---

### Phase 4: Pricing Engine (016-018)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 009_enhance_product_price2.sql | 016 | ✏️ RENAME | Enhance product_price2 table |
| 010_create_pricing_rules_engine.sql | 017 | ✏️ RENAME | Create pricing rules engine |
| - | 018 | 🆕 NEW | (Reserved for future pricing enhancements) |

**Conflicts Resolved:**
- ❌ REMOVE: `009_payroll_tables.sql` → Moved to 026
- ❌ REMOVE: `010_kpi_enhancements.sql` → Moved to 027

---

### Phase 5: Sales Intent System (019-021)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 012_create_sales_intent.sql | 019 | ✏️ RENAME | Create sales intent management system |
| 017_add_sales_intent_items.sql | 020 | ✏️ RENAME | Add multi-product support to sales intent |
| 016_fix_intent_number_generation.sql | 021 | ✏️ RENAME | Fix intent number generation function |
| 015_add_intent_permissions.sql | 022 | ✏️ RENAME | Add sales intent permissions |

**Dependency Chain:** 019 → 020 → 021 → 022

**Conflicts Resolved:**
- ❌ REMOVE: `012_clear_invoices_add_sample_products.sql` → Moved to 090

---

### Phase 6: Multi-Store Architecture (023)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 016_multi_store_architecture.sql | 023 | ✏️ RENAME | Multi-tenant and multi-store architecture |

**Conflicts Resolved:**
- ❌ REMOVE: `016_populate_pricing_test_data.sql` → Moved to 091

---

### Phase 7: Payroll System (024-032)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 006_employment_type_role_masters.sql | 024 | ✏️ RENAME | Employment type and role master tables |
| 007_salary_component_master.sql | 025 | ✏️ RENAME | Salary component master table |
| 008_flexible_salary_structure.sql | 026 | ✏️ RENAME | Employee salary structure table |
| 009_payroll_tables.sql | 027 | ✏️ RENAME | Payroll run and detail tables |
| 010_kpi_enhancements.sql | 028 | ✏️ RENAME | KPI enhancements for performance tracking |
| 011_update_payroll_permissions.sql | 029 | ✏️ RENAME | Update permissions for payroll module |
| - | 030 | 🆕 NEW | (Reserved: Payroll approval workflow) |
| - | 031 | 🆕 NEW | (Reserved: Payroll statutory compliance) |
| - | 032 | 🆕 NEW | (Reserved: Payroll reports and analytics) |

**Dependency Chain:** 024 → 025 → 026 → 027 → 028 → 029

**Note:** The consolidated migration `006-010_flexible_payroll_system_complete.sql` is **DEPRECATED** and replaced by individual migrations 024-029.

---

### Phase 8: Critical Bug Fixes (033-034)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 016_fix_pack_size_historical_bug.sql | 033 | ✏️ RENAME | **CRITICAL:** Fix pack size retroactive quantity bug |
| 016_rollback.sql | 033_rollback | ✏️ RENAME | Rollback for pack size fix |
| - | 034 | 🆕 NEW | (Reserved for future critical fixes) |

**Priority:** Migration 033 should be executed ASAP after payroll system (or before if needed independently).

---

### Phase 9: Test Data & Utilities (090-095)

| Current | New | Status | Description |
|---------|-----|--------|-------------|
| 012_clear_invoices_add_sample_products.sql | 090 | ✏️ RENAME | Clear invoices and add sample products (TEST DATA) |
| 013_delete_drug_products_add_hsn.sql | 091 | ✏️ RENAME | Delete drug products and add HSN (TEST DATA) |
| 016_populate_pricing_test_data.sql | 092 | ✏️ RENAME | Populate pricing test data (TEST DATA) |

**Note:** These migrations are for **DEVELOPMENT/TESTING ONLY** and should **NOT** be run in production.

---

## Migration Execution Order

### For Clean Database (Recommended Order)

```
002 → 003 → 004 → 005 →
006 →
008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 →
016 → 017 →
019 → 020 → 021 → 022 →
023 →
024 → 025 → 026 → 027 → 028 → 029 →
033
```

### For Production Database (Minimal Critical Path)

If you need only essential migrations:

```
002 → 006 → 033 (Critical bug fix)
```

Then add features as needed:
- HSN/Tax: 008-015
- Pricing: 016-017
- Sales Intent: 019-022
- Multi-Store: 023
- Payroll: 024-029

---

## Files to Archive/Remove

### Deprecated Consolidated Migration

**File:** `006-010_flexible_payroll_system_complete.sql`
**Action:** Archive to `sql/migrations/archive/deprecated/`
**Reason:** Uses `\i` includes which are fragile. Replaced by individual migrations 024-029.

### Test Data Migrations (Move to Separate Directory)

**Files:**
- `090_clear_invoices_add_sample_products.sql`
- `091_delete_drug_products_add_hsn.sql`
- `092_populate_pricing_test_data.sql`

**Action:** Move to `sql/migrations/test_data/`
**Reason:** Should never run in production. Keep separate for clarity.

---

## Rollback Script Requirements

### Existing Rollback Scripts ✅

- 002_rollback.sql → 002_rollback.sql (no change)
- 006_rollback.sql → 006_rollback.sql (no change)
- 016_rollback.sql → 033_rollback.sql (rename only)

### Missing Rollback Scripts 🚨

The following migrations **MUST** have rollback scripts created:

1. **003_rollback.sql** - Rollback HR management tables
2. **004_rollback.sql** - Rollback test DB setup
3. **005_rollback.sql** - Rollback HR permissions
4. **008_rollback.sql** - Rollback HSN tax master
5. **009-015_rollback.sql** - Rollback HSN/Tax migrations
6. **016-017_rollback.sql** - Rollback pricing engine
7. **019-022_rollback.sql** - Rollback sales intent system
8. **023_rollback.sql** - Rollback multi-store architecture
9. **024-029_rollback.sql** - Rollback payroll system

**Priority:** Create rollback scripts for 006 (already exists), 024-029 (payroll), and 033 (bug fix) first.

---

## Implementation Plan

### Step 1: Create Archive Directories

```bash
mkdir -p sql/migrations/archive/deprecated
mkdir -p sql/migrations/test_data
```

### Step 2: Execute Rename Operations

See **MIGRATION_RENAME_COMMANDS.bat** (Windows) or **MIGRATION_RENAME_COMMANDS.sh** (Linux/Mac) for complete rename script.

### Step 3: Move Files to Archive

```bash
# Archive deprecated consolidated migration
git mv sql/migrations/006-010_flexible_payroll_system_complete.sql sql/migrations/archive/deprecated/

# Move test data migrations
git mv sql/migrations/090_clear_invoices_add_sample_products.sql sql/migrations/test_data/
git mv sql/migrations/091_delete_drug_products_add_hsn.sql sql/migrations/test_data/
git mv sql/migrations/092_populate_pricing_test_data.sql sql/migrations/test_data/
```

### Step 4: Create Missing Rollback Scripts

Generate rollback scripts for all migrations without them.

### Step 5: Update Migration Tracking

- Update migration version table
- Document which migrations have been applied to each environment
- Create migration execution checklist

### Step 6: Test Migration Sequence

Test on development database:
```bash
# Test forward migrations
docker exec -i rgp-db psql -U rgpapp -d rgpdb_test < sql/migrations/002_fix_bill_number_race_condition.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb_test < sql/migrations/003_hr_management_tables.sql
# ... continue sequence

# Test rollback
docker exec -i rgp-db psql -U rgpapp -d rgpdb_test < sql/migrations/033_rollback.sql
```

---

## Risk Assessment

### High Risk 🔴

- **Breaking changes** if migrations are executed out of order
- **Data loss** if rollback scripts are missing or incorrect
- **Dependency failures** if foreign key references don't exist yet

### Medium Risk 🟡

- **Migration number gaps** (intentional for future migrations)
- **Test data mixing with production migrations** (mitigated by moving to separate directory)

### Low Risk 🟢

- **Simple renames** with no schema changes
- **File organization** improvements

---

## Validation Checklist

Before executing migrations in any environment:

- [ ] All migration numbers are unique and sequential
- [ ] Dependencies are satisfied (referenced tables exist)
- [ ] Rollback scripts exist and are tested
- [ ] Backup of database is current
- [ ] Migration sequence documented
- [ ] Test data migrations separated from production
- [ ] All stakeholders approve renumbering plan

---

## Approval Required

**Reviewed by:** _______________
**Approved by:** _______________
**Date:** _______________

---

## Next Steps

1. **Review this proposal** with development team
2. **Generate rename scripts** (see MIGRATION_RENAME_COMMANDS)
3. **Create missing rollback scripts**
4. **Test on development database**
5. **Update documentation** with new migration numbers
6. **Execute renaming** on main branch
7. **Notify all developers** of new numbering scheme

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
