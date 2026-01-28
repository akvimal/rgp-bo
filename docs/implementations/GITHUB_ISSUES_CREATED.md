# GitHub Issues Created - Purchase/Inventory Edge Case Implementation

**Date Created**: 2026-01-17
**Total Issues**: 9
**Status**: All created successfully

---

## Overview

Created comprehensive GitHub issues for the Purchase, Product, Inventory & Pricing Flow implementation plan. Issues cover all phases from critical P0 data integrity fixes to P2 monitoring and reporting features.

---

## Created Issues Summary

### Phase 1: Critical Atomicity Fixes (P0) - ✅ COMPLETED

| Issue # | Title | Status | Branch |
|---------|-------|--------|--------|
| [#118](https://github.com/akvimal/rgp-bo/issues/118) | Atomic Purchase Item Creation with Transaction Safety | ✅ Implemented | `fix/atomic-purchase-item-creation` |
| [#120](https://github.com/akvimal/rgp-bo/issues/120) | Concurrent Stock Adjustment Safety with Pessimistic Locking | ✅ Implemented | `fix/concurrent-stock-adjustment-locking` |
| [#119](https://github.com/akvimal/rgp-bo/issues/119) | Auto-Create Stock Record on Purchase Item Verification | ✅ Implemented | `feat/auto-stock-on-verification` |

**Implementation Summary:**
- **Files Modified**: 3 service files, 1 controller
- **Lines Changed**: ~300 lines added/modified
- **Key Features**:
  - SERIALIZABLE transactions for atomic operations
  - SELECT FOR UPDATE pessimistic locking
  - Automatic stock creation on verification
  - Comprehensive error handling and logging

---

### Phase 2: Batch/Expiry Management (P0) - 🔜 PENDING

| Issue # | Title | Story Points | Branch |
|---------|-------|--------------|--------|
| [#127](https://github.com/akvimal/rgp-bo/issues/127) | Implement Batch/Expiry Tracking with FEFO Enforcement | 13 | `feat/batch-expiry-fefo-system` |

**Scope:**
- Product batch master table with full traceability
- Batch movement logging (immutable audit trail)
- FEFO (First-Expiry-First-Out) allocation service
- Expiry validation in sales (block expired products)
- Automated near-expiry monitoring (30/60/90 days)
- Supplier-to-customer traceability API
- Data migration for existing batch data

**Estimated Effort**: 10-12 days

---

### Phase 3: Pricing & Validation (P1) - 🔜 PENDING

| Issue # | Title | Branch |
|---------|-------|--------|
| [#121](https://github.com/akvimal/rgp-bo/issues/121) | Product Deletion Validation & Safety | `feat/product-deletion-validation` |
| [#122](https://github.com/akvimal/rgp-bo/issues/122) | Auto-Calculate Price Margins & Validation | `feat/auto-calculate-price-margins` |
| [#123](https://github.com/akvimal/rgp-bo/issues/123) | Strict Pricing Rule Enforcement in Sales | `feat/strict-pricing-rule-enforcement` |
| [#124](https://github.com/akvimal/rgp-bo/issues/124) | Overpayment Prevention for Purchase Invoices | `feat/prevent-invoice-overpayment` |

**Scope:**
- Prevent deletion of products with active stock
- Auto-calculate margins and enforce min/max rules
- Block sales that violate pricing rules (strict mode)
- Prevent invoice overpayments

**Estimated Effort**: 4-5 days

---

### Phase 4: Monitoring & Reporting (P2) - 🔜 PENDING

| Issue # | Title | Branch |
|---------|-------|--------|
| [#125](https://github.com/akvimal/rgp-bo/issues/125) | Stock Variance Detection & Monitoring | `feat/stock-variance-detection` |
| [#126](https://github.com/akvimal/rgp-bo/issues/126) | Near-Expiry Dashboard & Reports | `feat/near-expiry-dashboard` |

**Scope:**
- Automated detection of unusual stock movements
- Daily variance reports and alerts
- Near-expiry dashboard (30/60/90 day buckets)
- Export to Excel functionality
- Action buttons: Discount, Return, Donate

**Estimated Effort**: 4-5 days

---

## Issue Labels Used

Since the repository has limited labels, all issues use standardized labels:
- `feature` - New functionality
- `bug` - Defects or fixes
- `backend` - Backend/API changes

**Note**: Custom labels (P0-critical, P1-high, P2-medium, concurrency, data-integrity) were specified in issue descriptions but not applied due to repository label limitations.

---

## Implementation Order

### Recommended Sequence

1. **Phase 2 (Issue #127)** - Batch/Expiry System (MOST CRITICAL)
   - Foundation for regulatory compliance
   - Prevents expired product sales
   - Required before other features

2. **Phase 3 (Issues #121-124)** - Pricing & Validation
   - Business rule enforcement
   - Prevents loss-making sales
   - Protects revenue

3. **Phase 4 (Issues #125-126)** - Monitoring & Reporting
   - Operational visibility
   - Proactive alerts
   - Management dashboards

---

## Next Actions

### Immediate
- [ ] Start Phase 2 implementation (Issue #127)
- [ ] Create database migration `009_product_batch_management.sql`
- [ ] Create `BatchAllocationService` with FEFO logic

### Short Term
- [ ] Write integration tests for Phase 1 (Issues #118, #119, #120)
- [ ] Update frontend to display batch information in POS
- [ ] Create near-expiry monitoring cron jobs

### Long Term
- [ ] Full E2E testing of purchase → verification → stock → sales flow
- [ ] Performance testing with 10,000+ batches
- [ ] User acceptance testing for batch workflows

---

## Issue Templates Used

Each issue includes:
- ✅ **Problem Statement** - Why this is needed
- ✅ **Test Scenarios** - Gherkin-style acceptance tests
- ✅ **Acceptance Criteria** - Definition of done
- ✅ **Branch Name** - Standardized naming
- ✅ **Implementation Status** - Current state (for completed issues)

---

## Related Documentation

- **Implementation Plan**: See original comprehensive plan in conversation history
- **Phase 1 Summary**: See `PHASE1_IMPLEMENTATION_COMPLETE.md` (if created)
- **Database Migrations**: `sql/migrations/` directory
- **Testing Guide**: To be created after Phase 2 completion

---

**Last Updated**: 2026-01-17
**Maintainer**: Development Team
**Status**: Phase 1 Complete ✅ | Phase 2-4 Pending 🔜
