#!/bin/bash
# ============================================================================
# Migration File Renumbering Script (Linux/Mac)
# ============================================================================
# Purpose: Rename migration files to resolve duplicate numbering
# Date: 2026-01-11
#
# IMPORTANT: Review MIGRATION_RENUMBERING_PROPOSAL.md before executing
#
# Usage:
#   1. Backup your sql/migrations directory first!
#   2. Review this script carefully
#   3. Make executable: chmod +x MIGRATION_RENAME_COMMANDS.sh
#   4. Run: ./MIGRATION_RENAME_COMMANDS.sh
# ============================================================================

set -e  # Exit on error

echo ""
echo "============================================================================"
echo "Migration File Renumbering Script"
echo "============================================================================"
echo ""
echo "WARNING: This script will rename migration files in sql/migrations/"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

# Change to migrations directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ============================================================================
# Phase 1: Infrastructure & Core (002-005)
# ============================================================================
echo ""
echo "[Phase 1] Infrastructure & Core - No changes needed"
echo "  002-005: KEEPING AS-IS"

# ============================================================================
# Phase 2: Purchase Invoice Lifecycle (006-007)
# ============================================================================
echo ""
echo "[Phase 2] Purchase Invoice Lifecycle"
echo "  006: KEEPING 006_enhanced_invoice_lifecycle.sql"
echo "  006_rollback: KEEPING 006_rollback.sql"

# ============================================================================
# Phase 3: HSN/Tax Management (008-015)
# ============================================================================
echo ""
echo "[Phase 3] HSN/Tax Management Renumbering..."

git mv 007_create_hsn_tax_master.sql 008_create_hsn_tax_master.sql
echo "  Renamed: 007 -> 008 (create_hsn_tax_master)"

git mv 008_populate_pharmacy_hsn_codes.sql 009_populate_pharmacy_hsn_codes.sql
echo "  Renamed: 008 -> 009 (populate_pharmacy_hsn_codes)"

git mv 013_comprehensive_hsn_tax_master_2025.sql 010_comprehensive_hsn_tax_master_2025.sql
echo "  Renamed: 013 -> 010 (comprehensive_hsn_tax_master_2025)"

git mv 014_update_hsn_codes_detailed.sql 011_update_hsn_codes_detailed.sql
echo "  Renamed: 014 -> 011 (update_hsn_codes_detailed)"

git mv 015_populate_pharmacy_hsn_codes.sql 012_populate_pharmacy_hsn_codes.sql
echo "  Renamed: 015 -> 012 (populate_pharmacy_hsn_codes - additional)"

git mv 012_update_medicine_gst_rates_2025.sql 013_update_medicine_gst_rates_2025.sql
echo "  Renamed: 012 -> 013 (update_medicine_gst_rates_2025)"

git mv 011_add_hsn_permissions.sql 014_add_hsn_permissions.sql
echo "  Renamed: 011 -> 014 (add_hsn_permissions)"

git mv 014_add_itc_tracking_fields.sql 015_add_itc_tracking_fields.sql
echo "  Renamed: 014 -> 015 (add_itc_tracking_fields)"

# ============================================================================
# Phase 4: Pricing Engine (016-018)
# ============================================================================
echo ""
echo "[Phase 4] Pricing Engine Renumbering..."

git mv 009_enhance_product_price2.sql 016_enhance_product_price2.sql
echo "  Renamed: 009 -> 016 (enhance_product_price2)"

git mv 010_create_pricing_rules_engine.sql 017_create_pricing_rules_engine.sql
echo "  Renamed: 010 -> 017 (create_pricing_rules_engine)"

# ============================================================================
# Phase 5: Sales Intent System (019-022)
# ============================================================================
echo ""
echo "[Phase 5] Sales Intent System Renumbering..."

git mv 012_create_sales_intent.sql 019_create_sales_intent.sql
echo "  Renamed: 012 -> 019 (create_sales_intent)"

git mv 017_add_sales_intent_items.sql 020_add_sales_intent_items.sql
echo "  Renamed: 017 -> 020 (add_sales_intent_items)"

git mv 016_fix_intent_number_generation.sql 021_fix_intent_number_generation.sql
echo "  Renamed: 016 -> 021 (fix_intent_number_generation)"

git mv 015_add_intent_permissions.sql 022_add_intent_permissions.sql
echo "  Renamed: 015 -> 022 (add_intent_permissions)"

# ============================================================================
# Phase 6: Multi-Store Architecture (023)
# ============================================================================
echo ""
echo "[Phase 6] Multi-Store Architecture Renumbering..."

git mv 016_multi_store_architecture.sql 023_multi_store_architecture.sql
echo "  Renamed: 016 -> 023 (multi_store_architecture)"

# ============================================================================
# Phase 7: Payroll System (024-029)
# ============================================================================
echo ""
echo "[Phase 7] Payroll System Renumbering..."

git mv 006_employment_type_role_masters.sql 024_employment_type_role_masters.sql
echo "  Renamed: 006 -> 024 (employment_type_role_masters)"

git mv 007_salary_component_master.sql 025_salary_component_master.sql
echo "  Renamed: 007 -> 025 (salary_component_master)"

git mv 008_flexible_salary_structure.sql 026_flexible_salary_structure.sql
echo "  Renamed: 008 -> 026 (flexible_salary_structure)"

git mv 009_payroll_tables.sql 027_payroll_tables.sql
echo "  Renamed: 009 -> 027 (payroll_tables)"

git mv 010_kpi_enhancements.sql 028_kpi_enhancements.sql
echo "  Renamed: 010 -> 028 (kpi_enhancements)"

git mv 011_update_payroll_permissions.sql 029_update_payroll_permissions.sql
echo "  Renamed: 011 -> 029 (update_payroll_permissions)"

# ============================================================================
# Phase 8: Critical Bug Fixes (033-034)
# ============================================================================
echo ""
echo "[Phase 8] Critical Bug Fixes Renumbering..."

git mv 016_fix_pack_size_historical_bug.sql 033_fix_pack_size_historical_bug.sql
echo "  Renamed: 016 -> 033 (fix_pack_size_historical_bug - CRITICAL)"

git mv 016_rollback.sql 033_rollback.sql
echo "  Renamed: 016_rollback -> 033_rollback"

# ============================================================================
# Phase 9: Test Data & Utilities (090-092)
# ============================================================================
echo ""
echo "[Phase 9] Test Data Renumbering..."

git mv 012_clear_invoices_add_sample_products.sql 090_clear_invoices_add_sample_products.sql
echo "  Renamed: 012 -> 090 (clear_invoices_add_sample_products - TEST DATA)"

git mv 013_delete_drug_products_add_hsn.sql 091_delete_drug_products_add_hsn.sql
echo "  Renamed: 013 -> 091 (delete_drug_products_add_hsn - TEST DATA)"

git mv 016_populate_pricing_test_data.sql 092_populate_pricing_test_data.sql
echo "  Renamed: 016 -> 092 (populate_pricing_test_data - TEST DATA)"

# ============================================================================
# Archive Deprecated Files
# ============================================================================
echo ""
echo "[Archive] Moving deprecated consolidated migration..."

# Create archive directory if it doesn't exist
mkdir -p archive/deprecated

git mv 006-010_flexible_payroll_system_complete.sql archive/deprecated/006-010_flexible_payroll_system_complete.sql.DEPRECATED
echo "  Archived: 006-010_flexible_payroll_system_complete.sql (DEPRECATED - replaced by 024-029)"

# ============================================================================
# Move Test Data to Separate Directory
# ============================================================================
echo ""
echo "[Organize] Moving test data migrations to separate directory..."

# Create test_data directory if it doesn't exist
mkdir -p test_data

git mv 090_clear_invoices_add_sample_products.sql test_data/090_clear_invoices_add_sample_products.sql
git mv 091_delete_drug_products_add_hsn.sql test_data/091_delete_drug_products_add_hsn.sql
git mv 092_populate_pricing_test_data.sql test_data/092_populate_pricing_test_data.sql

echo "  Moved 3 test data migrations to test_data/"

# ============================================================================
# Completion Summary
# ============================================================================
echo ""
echo "============================================================================"
echo "Migration Renumbering Complete!"
echo "============================================================================"
echo ""
echo "Summary:"
echo "  - Phase 1 (002-005): No changes (4 files)"
echo "  - Phase 2 (006-007): Kept as-is (2 files)"
echo "  - Phase 3 (008-015): Renumbered HSN/Tax migrations (8 files)"
echo "  - Phase 4 (016-018): Renumbered Pricing migrations (2 files)"
echo "  - Phase 5 (019-022): Renumbered Sales Intent migrations (4 files)"
echo "  - Phase 6 (023): Renumbered Multi-Store migration (1 file)"
echo "  - Phase 7 (024-029): Renumbered Payroll migrations (6 files)"
echo "  - Phase 8 (033): Renumbered Bug Fix migration (2 files)"
echo "  - Phase 9 (090-092): Renumbered Test Data migrations (3 files)"
echo "  - Archived: 1 deprecated consolidated migration"
echo "  - Total migrations renamed: 26 files"
echo ""
echo "Next Steps:"
echo "  1. Review the renamed files with: git status"
echo "  2. Verify no files are missing with: ls -1 *.sql"
echo "  3. Update migration tracking table"
echo "  4. Create missing rollback scripts"
echo "  5. Test migration sequence on development database"
echo "  6. Commit changes: git add . && git commit -m 'Renumber migrations to resolve conflicts'"
echo ""
echo "WARNING: Do NOT push to remote until testing is complete!"
echo ""
echo "============================================================================"
