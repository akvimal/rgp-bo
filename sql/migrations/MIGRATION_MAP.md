# Migration Numbering Map - Quick Reference

**Last Updated:** 2026-01-11
**Status:** Proposed Renumbering Scheme

---

## Current → New Migration Number Mapping

### ✅ No Changes (Keep As-Is)

| Current | New | File Name | Status |
|---------|-----|-----------|--------|
| 002 | 002 | fix_bill_number_race_condition.sql | ✅ KEEP |
| 002_rollback | 002_rollback | 002_rollback.sql | ✅ KEEP |
| 003 | 003 | hr_management_tables.sql | ✅ KEEP |
| 004 | 004 | setup_test_db.sql | ✅ KEEP |
| 005 | 005 | update_hr_permissions.sql | ✅ KEEP |
| 006 | 006 | enhanced_invoice_lifecycle.sql | ✅ KEEP |
| 006_rollback | 006_rollback | 006_rollback.sql | ✅ KEEP |

---

### ✏️ Renumber - HSN/Tax Management (008-015)

| Current | New | File Name | Category |
|---------|-----|-----------|----------|
| 007 | **008** | create_hsn_tax_master.sql | HSN/Tax |
| 008 | **009** | populate_pharmacy_hsn_codes.sql | HSN/Tax |
| 013 | **010** | comprehensive_hsn_tax_master_2025.sql | HSN/Tax |
| 014 | **011** | update_hsn_codes_detailed.sql | HSN/Tax |
| 015 | **012** | populate_pharmacy_hsn_codes.sql | HSN/Tax |
| 012 | **013** | update_medicine_gst_rates_2025.sql | HSN/Tax |
| 011 | **014** | add_hsn_permissions.sql | HSN/Tax |
| 014 | **015** | add_itc_tracking_fields.sql | HSN/Tax |

---

### ✏️ Renumber - Pricing Engine (016-018)

| Current | New | File Name | Category |
|---------|-----|-----------|----------|
| 009 | **016** | enhance_product_price2.sql | Pricing |
| 010 | **017** | create_pricing_rules_engine.sql | Pricing |

---

### ✏️ Renumber - Sales Intent System (019-022)

| Current | New | File Name | Category |
|---------|-----|-----------|----------|
| 012 | **019** | create_sales_intent.sql | Sales Intent |
| 017 | **020** | add_sales_intent_items.sql | Sales Intent |
| 016 | **021** | fix_intent_number_generation.sql | Sales Intent |
| 015 | **022** | add_intent_permissions.sql | Sales Intent |

---

### ✏️ Renumber - Multi-Store Architecture (023)

| Current | New | File Name | Category |
|---------|-----|-----------|----------|
| 016 | **023** | multi_store_architecture.sql | Multi-Store |

---

### ✏️ Renumber - Payroll System (024-029)

| Current | New | File Name | Category |
|---------|-----|-----------|----------|
| 006 | **024** | employment_type_role_masters.sql | Payroll |
| 007 | **025** | salary_component_master.sql | Payroll |
| 008 | **026** | flexible_salary_structure.sql | Payroll |
| 009 | **027** | payroll_tables.sql | Payroll |
| 010 | **028** | kpi_enhancements.sql | Payroll |
| 011 | **029** | update_payroll_permissions.sql | Payroll |

---

### ✏️ Renumber - Critical Bug Fixes (033)

| Current | New | File Name | Category |
|---------|-----|-----------|----------|
| 016 | **033** | fix_pack_size_historical_bug.sql | Bug Fix 🔴 |
| 016_rollback | **033_rollback** | 033_rollback.sql | Bug Fix Rollback |

---

### ✏️ Renumber - Test Data (090-092)

| Current | New | File Name | Category |
|---------|-----|-----------|----------|
| 012 | **090** | clear_invoices_add_sample_products.sql | Test Data 🧪 |
| 013 | **091** | delete_drug_products_add_hsn.sql | Test Data 🧪 |
| 016 | **092** | populate_pricing_test_data.sql | Test Data 🧪 |

---

### 🗑️ Archive/Deprecate

| Current | New Location | Status |
|---------|--------------|--------|
| 006-010_flexible_payroll_system_complete.sql | archive/deprecated/ | ❌ DEPRECATED |

**Reason:** Replaced by individual migrations 024-029. The consolidated migration uses `\i` includes which are fragile.

---

## Migration Execution Order (Recommended)

```
┌─────────────────────────────────────────────────────┐
│ INFRASTRUCTURE & CORE                               │
└─────────────────────────────────────────────────────┘
002 → 003 → 004 → 005

┌─────────────────────────────────────────────────────┐
│ PURCHASE INVOICE LIFECYCLE                          │
└─────────────────────────────────────────────────────┘
006

┌─────────────────────────────────────────────────────┐
│ HSN/TAX MANAGEMENT                                  │
└─────────────────────────────────────────────────────┘
008 → 009 → 010 → 011 → 012 → 013 → 014 → 015

┌─────────────────────────────────────────────────────┐
│ PRICING ENGINE                                      │
└─────────────────────────────────────────────────────┘
016 → 017

┌─────────────────────────────────────────────────────┐
│ SALES INTENT SYSTEM                                 │
└─────────────────────────────────────────────────────┘
019 → 020 → 021 → 022

┌─────────────────────────────────────────────────────┐
│ MULTI-STORE ARCHITECTURE                            │
└─────────────────────────────────────────────────────┘
023

┌─────────────────────────────────────────────────────┐
│ PAYROLL SYSTEM                                      │
└─────────────────────────────────────────────────────┘
024 → 025 → 026 → 027 → 028 → 029

┌─────────────────────────────────────────────────────┐
│ CRITICAL BUG FIXES                                  │
└─────────────────────────────────────────────────────┘
033 (Execute ASAP - fixes data integrity bug)

┌─────────────────────────────────────────────────────┐
│ TEST DATA (Development/Testing Only)                │
└─────────────────────────────────────────────────────┘
090, 091, 092 (DO NOT RUN IN PRODUCTION)
```

---

## Complete Sequential Order

For a fresh database installation:

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

---

## Dependency Graph

```
002 (Bill Number Fix)
└── 003 (HR Tables)
    └── 004 (Test DB Setup)
        └── 005 (HR Permissions)
            └── 006 (Enhanced Invoice)
                ├── 008-015 (HSN/Tax Chain)
                │   └── 016-017 (Pricing Chain)
                │       └── 019-022 (Sales Intent Chain)
                │           └── 023 (Multi-Store)
                │               └── 024-029 (Payroll Chain)
                │                   └── 033 (Pack Size Bug Fix)
                └── Test Data: 090, 091, 092 (Independent)
```

---

## Conflicts Resolved Summary

### Migration 006 (3 files → 1 production file)
- ✅ **006_enhanced_invoice_lifecycle.sql** (KEPT)
- ➡️ **006_employment_type_role_masters.sql** → 024
- ❌ **006-010_flexible_payroll_system_complete.sql** → DEPRECATED

### Migration 007 (2 files → 1 each)
- ➡️ **007_create_hsn_tax_master.sql** → 008
- ➡️ **007_salary_component_master.sql** → 025

### Migration 008 (2 files → 1 each)
- ➡️ **008_populate_pharmacy_hsn_codes.sql** → 009
- ➡️ **008_flexible_salary_structure.sql** → 026

### Migration 009 (2 files → 1 each)
- ➡️ **009_enhance_product_price2.sql** → 016
- ➡️ **009_payroll_tables.sql** → 027

### Migration 010 (2 files → 1 each)
- ➡️ **010_create_pricing_rules_engine.sql** → 017
- ➡️ **010_kpi_enhancements.sql** → 028

### Migration 011 (2 files → 1 each)
- ➡️ **011_add_hsn_permissions.sql** → 014
- ➡️ **011_update_payroll_permissions.sql** → 029

### Migration 012 (3 files → 1 production, 1 test)
- ➡️ **012_create_sales_intent.sql** → 019
- ➡️ **012_update_medicine_gst_rates_2025.sql** → 013
- ➡️ **012_clear_invoices_add_sample_products.sql** → 090 (Test Data)

### Migration 013 (2 files → 1 each)
- ➡️ **013_comprehensive_hsn_tax_master_2025.sql** → 010
- ➡️ **013_delete_drug_products_add_hsn.sql** → 091 (Test Data)

### Migration 014 (2 files → 1 each)
- ➡️ **014_add_itc_tracking_fields.sql** → 015
- ➡️ **014_update_hsn_codes_detailed.sql** → 011

### Migration 015 (2 files → 1 each)
- ➡️ **015_add_intent_permissions.sql** → 022
- ➡️ **015_populate_pharmacy_hsn_codes.sql** → 012

### Migration 016 (4 files → 1 production, 1 bug fix, 1 test)
- ➡️ **016_fix_intent_number_generation.sql** → 021
- ➡️ **016_multi_store_architecture.sql** → 023
- ➡️ **016_fix_pack_size_historical_bug.sql** → 033 (CRITICAL)
- ➡️ **016_populate_pricing_test_data.sql** → 092 (Test Data)

### Migration 017 (1 file)
- ➡️ **017_add_sales_intent_items.sql** → 020

---

## Reserved Numbers for Future Migrations

| Range | Purpose |
|-------|---------|
| 007 | Reserved for future invoice enhancements |
| 018 | Reserved for future pricing features |
| 030-032 | Reserved for payroll enhancements |
| 034-039 | Reserved for future bug fixes |
| 040-089 | Reserved for new feature modules |
| 093-099 | Reserved for test data utilities |

---

## Files After Renumbering

```
sql/migrations/
├── 002_fix_bill_number_race_condition.sql
├── 002_rollback.sql
├── 003_hr_management_tables.sql
├── 004_setup_test_db.sql
├── 005_update_hr_permissions.sql
├── 006_enhanced_invoice_lifecycle.sql
├── 006_rollback.sql
├── 008_create_hsn_tax_master.sql
├── 009_populate_pharmacy_hsn_codes.sql
├── 010_comprehensive_hsn_tax_master_2025.sql
├── 011_update_hsn_codes_detailed.sql
├── 012_populate_pharmacy_hsn_codes.sql
├── 013_update_medicine_gst_rates_2025.sql
├── 014_add_hsn_permissions.sql
├── 015_add_itc_tracking_fields.sql
├── 016_enhance_product_price2.sql
├── 017_create_pricing_rules_engine.sql
├── 019_create_sales_intent.sql
├── 020_add_sales_intent_items.sql
├── 021_fix_intent_number_generation.sql
├── 022_add_intent_permissions.sql
├── 023_multi_store_architecture.sql
├── 024_employment_type_role_masters.sql
├── 025_salary_component_master.sql
├── 026_flexible_salary_structure.sql
├── 027_payroll_tables.sql
├── 028_kpi_enhancements.sql
├── 029_update_payroll_permissions.sql
├── 033_fix_pack_size_historical_bug.sql
├── 033_rollback.sql
├── archive/
│   └── deprecated/
│       └── 006-010_flexible_payroll_system_complete.sql.DEPRECATED
├── test_data/
│   ├── 090_clear_invoices_add_sample_products.sql
│   ├── 091_delete_drug_products_add_hsn.sql
│   └── 092_populate_pricing_test_data.sql
├── MIGRATION_MAP.md (this file)
├── MIGRATION_RENAME_COMMANDS.bat
└── MIGRATION_RENAME_COMMANDS.sh
```

---

## Quick Validation Commands

### Check for Duplicate Numbers
```bash
ls -1 *.sql | sed 's/_.*//g' | sort | uniq -d
```
Should return nothing if all conflicts are resolved.

### Count Migrations by Range
```bash
echo "Infrastructure (002-005): $(ls 00[2-5]_*.sql 2>/dev/null | wc -l)"
echo "Invoice (006-007): $(ls 00[6-7]_*.sql 2>/dev/null | wc -l)"
echo "HSN/Tax (008-015): $(ls 0[01][0-5]_*.sql 2>/dev/null | wc -l)"
echo "Pricing (016-018): $(ls 01[6-8]_*.sql 2>/dev/null | wc -l)"
echo "Sales Intent (019-022): $(ls 0[12][0-2]_*.sql 2>/dev/null | wc -l)"
echo "Multi-Store (023): $(ls 023_*.sql 2>/dev/null | wc -l)"
echo "Payroll (024-029): $(ls 02[4-9]_*.sql 2>/dev/null | wc -l)"
echo "Bug Fixes (033): $(ls 033_*.sql 2>/dev/null | wc -l)"
```

### Verify All Files Present
```bash
# Should show 31 production migration files
ls -1 0*.sql | grep -v rollback | wc -l
```

---

**End of Migration Map**
