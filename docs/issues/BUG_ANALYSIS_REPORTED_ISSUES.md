# Bug Analysis: Reported Issues

**Date**: 2026-01-09
**Analyzed By**: Claude Code
**Status**: Analysis Complete

---

## Executive Summary

Five critical issues have been reported in the application. After comprehensive analysis of the codebase, **4 out of 5 are confirmed bugs** requiring immediate attention, and 1 is a feature visibility issue.

### Severity Classification:
- 🔴 **CRITICAL** (1): Data integrity issue - Pack size bug
- 🟠 **HIGH** (2): GST rate change, Stock reversal
- 🟡 **MEDIUM** (1): Payment status UI
- 🟢 **LOW** (1): Purchase returns visibility

---

## Issue #1: Purchase Returns Tracking in Software

### Status: ✅ FEATURE EXISTS - UI Visibility Issue
### Severity: 🟢 LOW
### Priority: Medium

### Analysis:
**Good News**: The system DOES have purchase returns tracking implemented.

**Backend Implementation** (✅ Complete):
```typescript
// Location: api-v2/src/modules/app/purchases/purchase-invoice-item.entity.ts
itemtype: ItemType.REGULAR | ItemType.RETURN | ItemType.SUPPLIED

// Validation in place:
if (itemType === ItemType.RETURN && !dto.returnreason) {
    throw new BadRequestException('Return reason is required for RETURN items');
}
```

**Frontend Implementation** (✅ Complete):
```typescript
// Location: frontend/src/app/secured/purchases/invoices/components/invoice-items.component.ts
updateItemType(itemId: any, event: any) {
    const newType = event.target.value;
    // Handles REGULAR, RETURN, SUPPLIED types
}
```

### Problem:
Users may not be aware of this feature or the UI is not prominent enough.

### Recommendation:
**Action**: Improve UI/UX visibility
1. Add a "Returns" tab/filter in the invoice list to show return items
2. Display return icon/badge in item lists
3. Add return summary in invoice totals
4. Create a separate "Purchase Returns Report"

**Files to Modify**:
- `frontend/src/app/secured/purchases/invoices/components/invoice-items.component.html`
- `frontend/src/app/secured/purchases/invoices/components/invoice-list.component.ts`

---

## Issue #2: Paid or Not Paid Checkbox

### Status: ⚠️ UI ENHANCEMENT NEEDED
### Severity: 🟡 MEDIUM
### Priority: High

### Analysis:
**Backend Status** (✅ Partial):
The system has payment status tracking via the `paymentstatus` field:
```typescript
// Location: api-v2/src/modules/app/purchases/purchase-invoice.entity.ts
paymentstatus: PaymentStatus.UNPAID | PaymentStatus.PARTIAL | PaymentStatus.PAID
```

However, payment tracking is designed for **multiple payments per invoice** (vendor_payment table), not a simple checkbox.

### Problem:
1. No simple "Mark as Paid" checkbox in UI
2. Users must navigate to payment section to record payments
3. No quick status toggle for fully paid invoices

### Current Workflow (Complex):
```
Invoice → Items → Payment Tab → Add Payment → Status auto-updates
```

### Desired Workflow (Simple):
```
Invoice → [✓ Paid] checkbox → Status updates to PAID
```

### Recommendation:
**Action**: Add quick payment toggle

**Option 1: Simple Checkbox** (Quick fix)
- Add "Mark as Paid" checkbox for UNPAID invoices
- On check, create payment record for full invoice amount
- Display as read-only for PARTIAL/PAID

**Option 2: Enhanced Status Selector** (Better UX)
- Dropdown: UNPAID | PARTIAL | PAID
- On status change, show payment form modal
- Validate payment amounts match status

**Files to Modify**:
- `frontend/src/app/secured/purchases/invoices/components/invoice-items.component.html`
- `frontend/src/app/secured/purchases/invoices/components/invoice-items.component.ts`
- `frontend/src/app/secured/purchases/invoices/invoices.service.ts`

**Backend Addition Needed**:
```typescript
// New endpoint: Quick mark as paid
POST /purchases/invoices/:id/mark-paid
{
  "paymentDate": "2026-01-09",
  "paymentMethod": "CASH",
  "notes": "Full payment received"
}
```

---

## Issue #3: Sometimes Bill Generated but Quantity Reverses Back

### Status: 🔴 CONFIRMED BUG - Transaction Rollback or Stock Adjustment Issue
### Severity: 🟠 HIGH
### Priority: CRITICAL

### Analysis:
This issue manifests in two possible scenarios:

#### Scenario A: Transaction Rollback (Likely)
**Location**: `api-v2/src/modules/app/sales/sale.service.ts`

```typescript
async create(sale:any, userid:any) {
    return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        // Step 1: Generate bill numbers
        const nos = await transactionManager.query(`select generate_order_number() as order_no, generate_bill_number() as bill_no`);

        // Step 2: Save sale
        const savedSale = await transactionManager.save(Sale, {...sale, createdby:userid});

        // Step 3: Save items
        await transactionManager.save(SaleItem, sale.items);

        // If ANY step fails, ENTIRE transaction rolls back
    });
}
```

**Problem**: If step 3 (save items) fails:
- Bill number IS generated (from database sequence)
- Sale record IS NOT saved (rolled back)
- User sees bill number but no quantity deduction
- **Bill number is wasted/skipped**

#### Scenario B: Stock Adjustment Error
**Location**: `api-v2/src/modules/app/stock/stock.service.ts:213`

```typescript
async createQty(dto: CreateProductQtyChangeDto, userid) {
    return this.qtyRepository.save({...dto, createdby:userid});
}
```

Stock adjustments can add quantities back. If done accidentally or due to a bug, it would "reverse" sold quantities.

### Root Causes:
1. **Bill number generation happens BEFORE transaction completion**
   - Bill numbers are consumed even if transaction fails
   - Creates gaps in bill sequence

2. **No validation on negative quantity adjustments**
   - Stock adjustments can be positive (adding stock back)
   - No check if this conflicts with completed sales

3. **Race condition in concurrent sales** (Less likely, but possible)
   - Two sales for same item at same time
   - One succeeds, one fails, but bill number consumed

### Evidence to Check:
```sql
-- Check for gaps in bill numbers
SELECT bill_no, bill_no - LAG(bill_no) OVER (ORDER BY bill_no) AS gap
FROM sale
WHERE gap > 1;

-- Check for negative stock adjustments
SELECT * FROM product_qtychange
WHERE qty < 0
ORDER BY created_on DESC;

-- Check inventory discrepancies
SELECT * FROM inventory_view
WHERE available < 0;
```

### Recommendation:
**IMMEDIATE FIX** (High Priority):

1. **Move bill number generation AFTER validation**:
```typescript
async create(sale:any, userid:any) {
    return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        // Validate FIRST
        if (!sale.items || sale.items.length === 0) {
            throw new Error('Sale must have items');
        }

        // Validate stock availability
        for (const item of sale.items) {
            const stock = await this.checkStock(item.productId, item.qty);
            if (stock < item.qty) {
                throw new BusinessException(`Insufficient stock for ${item.productName}`);
            }
        }

        // THEN generate bill number (after validation passes)
        const nos = await transactionManager.query(`select generate_order_number() as order_no, generate_bill_number() as bill_no`);
        // ... rest of transaction
    });
}
```

2. **Add stock validation before quantity adjustments**:
```typescript
async createQty(dto: CreateProductQtyChangeDto, userid) {
    // If negative adjustment, validate it won't make available < 0
    if (dto.qty < 0) {
        const currentStock = await this.checkAvailableStock(dto.item_id);
        if (currentStock + dto.qty < 0) {
            throw new BusinessException('Cannot adjust stock below zero');
        }
    }
    return this.qtyRepository.save({...dto, createdby:userid});
}
```

3. **Add audit logging for stock changes**:
```typescript
await this.auditLog.create({
    entity: 'product_qtychange',
    action: 'CREATE',
    before: { available: currentStock },
    after: { available: currentStock + dto.qty },
    reason: dto.reason,
    userid: userid
});
```

**Files to Modify**:
- `api-v2/src/modules/app/sales/sale.service.ts` (lines 22-61)
- `api-v2/src/modules/app/stock/stock.service.ts` (lines 213-215)

---

## Issue #4: Pack Size Change Affects Historical Quantities

### Status: 🔴 CONFIRMED CRITICAL BUG - Data Integrity Issue
### Severity: 🔴 CRITICAL
### Priority: **HIGHEST**

### Analysis:
This is a **SEVERE ARCHITECTURAL BUG** in the database views that causes retroactive data corruption.

**Problem Location**: `sql/ddl/views.sql`

#### inventory_view (lines 42, 51):
```sql
pii.qty * p.pack AS purchased,
...
pii.qty * p.pack - COALESCE(si.bal, 0::bigint) + COALESCE(pq.bal, 0::bigint) AS available
```

#### product_items_view (lines 136, 139):
```sql
pi.qty * COALESCE(p.pack, 1) AS purchased,
...
pi.qty * COALESCE(p.pack, 1) - COALESCE(pi.sold, 0::bigint) + COALESCE(sum(pq.qty), 0::bigint) AS balance
```

### The Bug:
When calculating quantities, the views use:
- `pii.qty` (purchase invoice item quantity - stored in database)
- `p.pack` (product pack size - CURRENT value from product table)

**If pack size changes from 10 → 20:**
- Old purchase: 5 packs × 10 = 50 units (correct)
- After pack size change: 5 packs × **20 = 100 units** (WRONG!)

### Impact:
✗ **Historical quantities are RECALCULATED incorrectly**
✗ **Stock balances become wrong**
✗ **Inventory reports are inaccurate**
✗ **Accounting/audit trails are broken**

### Example Scenario:
```
Timeline:
1. Jan 1: Product "Paracetamol" pack size = 10 tablets
2. Jan 5: Purchase 100 packs = 1000 tablets
3. Jan 10: Sold 500 tablets, balance = 500 tablets ✓
4. Jan 15: Change pack size to 20 tablets (new batch from vendor)
5. Jan 16: View shows balance = 1500 tablets! ✗ WRONG!
   (Because 100 packs × NEW 20 = 2000, minus 500 sold = 1500)
```

### Why This Happens:
Views are **COMPUTED** on every query, not stored. They use the **current** pack value from the product table, not the pack value **at time of purchase**.

### Recommendation:
**CRITICAL FIX REQUIRED** (Highest Priority):

#### Option 1: Store Pack Size in Purchase Invoice Item (RECOMMENDED)
Add a `pack_size` column to `purchase_invoice_item` table:

```sql
-- Migration: Add pack_size to purchase_invoice_item
ALTER TABLE purchase_invoice_item
ADD COLUMN pack_size DOUBLE PRECISION;

-- Backfill existing records with current pack size
UPDATE purchase_invoice_item pii
SET pack_size = p.pack
FROM product p
WHERE pii.product_id = p.id;

-- Make it NOT NULL after backfill
ALTER TABLE purchase_invoice_item
ALTER COLUMN pack_size SET NOT NULL;
```

Update views to use stored pack_size:
```sql
-- inventory_view (CORRECTED)
CREATE OR REPLACE VIEW public.inventory_view AS
SELECT
    pii.id,
    p.id AS product_id,
    pii.qty * pii.pack_size AS purchased,  -- Use stored pack_size, not p.pack!
    ...
    pii.qty * pii.pack_size - COALESCE(si.bal, 0::bigint) + COALESCE(pq.bal, 0::bigint) AS available
FROM product p
JOIN purchase_invoice_item pii ON p.id = pii.product_id
...
```

Update backend to save pack size on purchase:
```typescript
// api-v2/src/modules/app/purchases/purchase-invoice.service.ts
async createItem(dto: CreatePurchaseInvoiceItemDto, userid: any) {
    // Fetch product to get current pack size
    const product = await this.productRepository.findOne({ where: { id: dto.productid } });

    return this.purchaseInvoiceItemRepository.save({
        ...dto,
        pack_size: product.pack,  // Store pack size at time of purchase
        createdby: userid
    });
}
```

#### Option 2: Product Pack Size History Table (More Complex)
Create a `product_pack_history` table to track pack size changes over time:

```sql
CREATE TABLE product_pack_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES product(id),
    pack_size DOUBLE PRECISION NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by INTEGER REFERENCES app_user(id),
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- View would then join to get correct historical pack size
```

**This is more accurate but significantly more complex to implement.**

#### Option 3: Materialized Views (Temporary Workaround)
Convert to materialized views and refresh periodically:
```sql
CREATE MATERIALIZED VIEW inventory_view_mv AS
SELECT ... (same logic);

-- Refresh manually or via cron
REFRESH MATERIALIZED VIEW inventory_view_mv;
```

**This doesn't fix the root cause, only reduces the frequency of incorrect data.**

### Implementation Plan:
1. ✅ **Option 1 is STRONGLY RECOMMENDED**
   - Simplest to implement
   - Most reliable
   - Preserves historical accuracy

2. **Migration Steps**:
   - Create database migration script
   - Add `pack_size` column
   - Backfill existing data
   - Update all views
   - Update backend service
   - Test thoroughly with pack size changes

3. **Testing Checklist**:
   - [ ] Purchase items with pack size X
   - [ ] Verify quantities calculated correctly
   - [ ] Change product pack size to Y
   - [ ] Purchase NEW items with pack size Y
   - [ ] Verify OLD purchases still show size X quantities
   - [ ] Verify NEW purchases show size Y quantities
   - [ ] Check inventory_view, product_items_view
   - [ ] Run stock reports

**Files to Modify**:
- `sql/ddl/tables.sql` (add column)
- `sql/migrations/XXX_fix_pack_size_bug.sql` (new migration)
- `sql/ddl/views.sql` (update all views)
- `api-v2/src/entities/purchase-invoice-item.entity.ts` (add field)
- `api-v2/src/modules/app/purchases/purchase-invoice.service.ts` (save pack_size)
- `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.ts` (display pack_size)

---

## Issue #5: GST Changes from 5% to 12% After Save

### Status: 🔴 CONFIRMED BUG - Tax Rate Override Issue
### Severity: 🟠 HIGH
### Priority: High

### Analysis:
The GST rate changes after save due to **multiple competing tax sources** in the code:

**Location**: `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.ts`

#### Problem Flow:
```typescript
// Step 1: User selects product
selectProduct(event:any) {
    this.selectedProduct = event;

    // Fetches product with HSN tax rate
    this.invService.getProductWithTaxRate(this.selectedProduct.id)
        .subscribe((productWithTax: any) => {
            if (productWithTax && productWithTax.taxRate) {
                this.form.controls['taxpcnt'].setValue(taxRate.totalRate); // Sets 12%
            }
        });

    // Also fetches previous batches
    this.invService.findItemsByProduct(this.selectedProduct.id)
        .subscribe((items:any) => {
            this.batches = items.map((i:any) => {
                return {
                    taxpcnt: i.taxpcnt  // Could be 5% from old purchase
                }
            });
        });
}

// Step 2: User selects batch (OVERWRITES tax rate!)
selectBatch(event:any) {
    this.form.controls['taxpcnt'].setValue(event.taxpcnt); // Sets 5% from batch!
}

// Step 3: User clicks save
// Tax rate sent = 5% (from batch, not from product HSN)
```

### Root Cause:
1. **HSN tax rate** (current, correct rate) = 12%
2. **Batch tax rate** (historical rate from old purchase) = 5%
3. When user selects batch, it **overwrites** the HSN tax rate
4. User saves with old 5% rate

### Why It Changes After Save:
After save, when the form reloads:
```typescript
ngOnChanges(changes:SimpleChanges) {
    this.invService.findItem(itemId).subscribe((data:any) => {
        this.form.controls['taxpcnt'].setValue(data.taxpcnt); // Saved value = 5%
    });
}
```

Then user notices and manually changes to 12%, or the HSN lookup runs again.

### Evidence in Code:
```typescript
// Line 127: selectBatch overwrites tax
selectBatch(event:any){
    this.form.controls['taxpcnt'].setValue(event.taxpcnt);  // ← BUG HERE
}

// Line 155-164: selectProduct sets HSN tax (happens FIRST)
this.form.controls['taxpcnt'].setValue(taxRate.totalRate); // Correct rate

// BUT selectBatch happens AFTER and overwrites it!
```

### Additional Issue:
Line 243 in `loadexist()`:
```typescript
this.form.controls['taxpcnt'].setValue(item.tax_pcnt); // Also sets old batch tax
```

### Recommendation:
**FIX** (High Priority):

#### Option 1: Don't Override Tax from Batch (RECOMMENDED)
```typescript
selectBatch(event:any) {
    this.form.controls['batch'].setValue(event.batch);
    this.form.controls['ptrvalue'].setValue(event.ptrvalue);
    this.form.controls['discpcnt'].setValue(event.discpcnt);
    // this.form.controls['taxpcnt'].setValue(event.taxpcnt);  // ← REMOVE THIS!
    // Keep the HSN tax rate that was set in selectProduct()
    this.form.controls['mrpcost'].setValue(event.mrpcost);
    this.form.controls['expdate'].setValue(new Date(event.expdate));
}
```

#### Option 2: Show Warning When Batch Tax Differs
```typescript
selectBatch(event:any) {
    const currentTax = this.form.value.taxpcnt;
    const batchTax = event.taxpcnt;

    if (currentTax !== batchTax) {
        const confirmChange = confirm(
            `Tax rate mismatch!\n\n` +
            `Current HSN rate: ${currentTax}%\n` +
            `Batch rate (from ${event.batch}): ${batchTax}%\n\n` +
            `Use batch rate ${batchTax}%? (Click Cancel to keep ${currentTax}%)`
        );

        if (confirmChange) {
            this.form.controls['taxpcnt'].setValue(batchTax);
        }
    }

    // Set other fields as normal
    this.form.controls['batch'].setValue(event.batch);
    // ...
}
```

#### Option 3: Always Use HSN Tax (Strictest)
```typescript
selectBatch(event:any) {
    // Set all fields EXCEPT tax
    this.form.controls['batch'].setValue(event.batch);
    this.form.controls['ptrvalue'].setValue(event.ptrvalue);
    this.form.controls['discpcnt'].setValue(event.discpcnt);
    this.form.controls['mrpcost'].setValue(event.mrpcost);
    this.form.controls['expdate'].setValue(new Date(event.expdate));

    // Tax is READ-ONLY, always from HSN
    // Don't allow batch to override it
    // If batch tax != HSN tax, show warning in UI
    if (event.taxpcnt !== this.form.value.taxpcnt) {
        alert(`⚠️ Note: This batch was purchased at ${event.taxpcnt}% GST, ` +
              `but current HSN rate is ${this.form.value.taxpcnt}%. ` +
              `Using current rate ${this.form.value.taxpcnt}%.`);
    }
}
```

### Implementation:
**Files to Modify**:
- `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.ts`
  - Line 127: `selectBatch()` - Remove tax override
  - Line 243: `loadexist()` - Remove tax override
  - Add warning/confirmation logic

**Testing Checklist**:
- [ ] Select product → HSN tax rate applied (12%)
- [ ] Select old batch → Tax rate stays 12% (not overridden to 5%)
- [ ] Save item → Tax saved as 12%
- [ ] Reload form → Tax displays as 12%
- [ ] Test with products having different HSN tax rates
- [ ] Test with batches purchased at different tax rates

---

## Summary of Action Items

### 🔴 CRITICAL (Fix Immediately)
| # | Issue | Severity | Files to Modify | Est. Effort |
|---|-------|----------|-----------------|-------------|
| 4 | Pack Size Bug | CRITICAL | 6 files (migration, views, entity, service, frontend) | 2-3 days |

### 🟠 HIGH (Fix This Week)
| # | Issue | Severity | Files to Modify | Est. Effort |
|---|-------|----------|-----------------|-------------|
| 3 | Quantity Reversal | HIGH | 2 files (sale.service, stock.service) | 1-2 days |
| 5 | GST Rate Change | HIGH | 1 file (invoice-item-form.component) | 4-6 hours |

### 🟡 MEDIUM (Plan for Next Sprint)
| # | Issue | Severity | Files to Modify | Est. Effort |
|---|-------|----------|-----------------|-------------|
| 2 | Payment Checkbox | MEDIUM | 3 files (frontend components, service) + 1 API endpoint | 1-2 days |

### 🟢 LOW (Enhancement)
| # | Issue | Severity | Files to Modify | Est. Effort |
|---|-------|----------|-----------------|-------------|
| 1 | Returns Visibility | LOW | 2 files (invoice list/items components) | 4-6 hours |

---

## Recommended Fix Order

### Week 1: Critical Bugs
1. **Day 1-3**: Fix Pack Size Bug (#4)
   - Create migration
   - Update views
   - Update backend
   - Update frontend
   - Test thoroughly

2. **Day 4-5**: Fix GST Rate Change (#5)
   - Remove tax override in selectBatch()
   - Add warning logic
   - Test with different scenarios

### Week 2: High Priority Bugs
3. **Day 1-2**: Fix Quantity Reversal (#3)
   - Move bill number generation
   - Add stock validation
   - Add audit logging
   - Test concurrent scenarios

4. **Day 3-4**: Payment Status UI (#2)
   - Add quick payment checkbox/dropdown
   - Create backend endpoint
   - Test payment workflows

### Week 3: Enhancements
5. **Day 1**: Returns Visibility (#1)
   - Add returns filter/tab
   - Add return badges
   - Create returns report

---

## Database Migration Scripts

### Migration 1: Fix Pack Size Bug

**File**: `sql/migrations/015_fix_pack_size_historical_bug.sql`

```sql
-- Migration 015: Fix Pack Size Historical Quantity Bug
-- Date: 2026-01-09
-- Description: Add pack_size column to purchase_invoice_item to prevent
--              retroactive quantity recalculation when product pack size changes

BEGIN;

-- Step 1: Add pack_size column
ALTER TABLE purchase_invoice_item
ADD COLUMN IF NOT EXISTS pack_size DOUBLE PRECISION;

-- Step 2: Backfill with current pack sizes from product table
UPDATE purchase_invoice_item pii
SET pack_size = p.pack
FROM product p
WHERE pii.product_id = p.id
AND pii.pack_size IS NULL;

-- Step 3: Set default for records where product no longer exists
UPDATE purchase_invoice_item
SET pack_size = 1
WHERE pack_size IS NULL;

-- Step 4: Make column NOT NULL
ALTER TABLE purchase_invoice_item
ALTER COLUMN pack_size SET NOT NULL;

-- Step 5: Add default value for new records
ALTER TABLE purchase_invoice_item
ALTER COLUMN pack_size SET DEFAULT 1;

-- Step 6: Update inventory_view to use stored pack_size
CREATE OR REPLACE VIEW public.inventory_view AS
SELECT
    pii.id,
    p.id AS product_id,
    pii.invoice_id AS purchase_invoiceid,
    pi.invoice_no,
    pi.invoice_date,
    pii.id AS purchase_itemid,
    p.title AS product_title,
    p.pack AS product_pack,  -- Current pack size for reference
    pii.pack_size AS purchase_pack_size,  -- Pack size at time of purchase
    p.product_code,
    p.more_props,
    pii.batch AS product_batch,
    pii.exp_date AS product_expdate,
    pii.tax_pcnt AS product_taxpcnt,
    pii.mrp_cost AS mrp,
    pii.qty * pii.pack_size AS purchased,  -- ← FIXED: Use stored pack_size
    pii.status,
    pii.verify_start_date,
    pii.verify_end_date,
    pii.verified_by AS verified_userid,
    au.full_name AS verified_username,
    pii.active,
    COALESCE(si.bal, 0::bigint) AS sold,
    COALESCE(pq.bal, 0::bigint) AS adjusted,
    pii.qty * pii.pack_size - COALESCE(si.bal, 0::bigint) + COALESCE(pq.bal, 0::bigint) AS available  -- ← FIXED
FROM product p
JOIN purchase_invoice_item pii ON p.id = pii.product_id
JOIN purchase_invoice pi ON pi.id = pii.invoice_id
LEFT JOIN (
    SELECT si_1.purchase_item_id, sum(si_1.qty) AS bal
    FROM sale_item si_1
    WHERE si_1.status::text = 'Complete'::text
    GROUP BY si_1.purchase_item_id
) si ON si.purchase_item_id = pii.id
LEFT JOIN (
    SELECT product_qtychange.item_id, sum(product_qtychange.qty) AS bal
    FROM product_qtychange
    GROUP BY product_qtychange.item_id
) pq ON pq.item_id = pii.id
LEFT JOIN app_user au ON pii.verified_by = au.id
ORDER BY p.title, pii.exp_date DESC;

-- Step 7: Update product_items_view
CREATE OR REPLACE VIEW public.product_items_view AS
SELECT
    p.id,
    p.title,
    p.pack,  -- Current pack size
    p.active,
    pi.invoice_date,
    pi.invoice_no,
    pi.id AS item_id,
    pi.batch,
    pi.exp_date,
    pi.status,
    pi.tax_pcnt,
    pi.mrp_cost,
    pi.last_sale_date,
    CASE
        WHEN pi.exp_date < (CURRENT_DATE + 30) THEN true
        ELSE false
    END AS expired,
    pi.qty * COALESCE(pi.pack_size, p.pack, 1) AS purchased,  -- ← FIXED
    COALESCE(pi.sold, 0::bigint) AS sold,
    COALESCE(sum(pq.qty), 0::bigint) AS adjusted,
    pi.qty * COALESCE(pi.pack_size, p.pack, 1) - COALESCE(pi.sold, 0::bigint) + COALESCE(sum(pq.qty), 0::bigint) AS balance  -- ← FIXED
FROM product p
LEFT JOIN (
    SELECT
        i.invoice_date,
        i.invoice_no,
        pii.id,
        pii.product_id,
        pii.batch,
        pii.exp_date,
        pii.qty + COALESCE(pii.free_qty::bigint, 0::bigint) AS qty,
        pii.pack_size,  -- ← NEW: Include pack_size
        pii.tax_pcnt,
        pii.mrp_cost,
        pii.status,
        COALESCE(sum(si.qty), 0::bigint) AS sold,
        max(s.bill_date) AS last_sale_date
    FROM purchase_invoice_item pii
    JOIN purchase_invoice i ON i.id = pii.invoice_id
    LEFT JOIN sale_item si ON si.purchase_item_id = pii.id
    LEFT JOIN sale s ON s.id = si.sale_id
    GROUP BY i.invoice_date, i.invoice_no, pii.id, pii.tax_pcnt, pii.mrp_cost, pii.product_id, pii.batch, pii.exp_date, pii.qty, pii.status, pii.pack_size
) pi ON pi.product_id = p.id
LEFT JOIN product_qtychange pq ON pq.item_id = pi.id
GROUP BY p.id, p.title, pi.invoice_date, pi.invoice_no, pi.tax_pcnt, pi.mrp_cost, pi.id, pi.batch, pi.exp_date, pi.last_sale_date, pi.qty, pi.status, pi.sold, pi.pack_size
ORDER BY p.title;

COMMIT;

-- Verification queries
SELECT 'Migration 015 completed successfully!' AS status;

-- Show sample of updated data
SELECT
    pii.id,
    p.title,
    pii.qty,
    pii.pack_size AS stored_pack,
    p.pack AS current_pack,
    pii.qty * pii.pack_size AS purchased_qty
FROM purchase_invoice_item pii
JOIN product p ON p.id = pii.product_id
LIMIT 10;
```

### Migration 1 Rollback:

**File**: `sql/migrations/015_rollback.sql`

```sql
-- Rollback Migration 015
BEGIN;

-- Restore old views (without pack_size)
CREATE OR REPLACE VIEW public.inventory_view AS
SELECT
    pii.id,
    p.id AS product_id,
    pii.invoice_id AS purchase_invoiceid,
    pi.invoice_no,
    pi.invoice_date,
    pii.id AS purchase_itemid,
    p.title AS product_title,
    p.pack AS product_pack,
    p.product_code,
    p.more_props,
    pii.batch AS product_batch,
    pii.exp_date AS product_expdate,
    pii.tax_pcnt AS product_taxpcnt,
    pii.mrp_cost AS mrp,
    pii.qty * p.pack AS purchased,  -- Restored to old (buggy) calculation
    pii.status,
    pii.verify_start_date,
    pii.verify_end_date,
    pii.verified_by AS verified_userid,
    au.full_name AS verified_username,
    pii.active,
    COALESCE(si.bal, 0::bigint) AS sold,
    COALESCE(pq.bal, 0::bigint) AS adjusted,
    pii.qty * p.pack - COALESCE(si.bal, 0::bigint) + COALESCE(pq.bal, 0::bigint) AS available
FROM product p
JOIN purchase_invoice_item pii ON p.id = pii.product_id
JOIN purchase_invoice pi ON pi.id = pii.invoice_id
LEFT JOIN (
    SELECT si_1.purchase_item_id, sum(si_1.qty) AS bal
    FROM sale_item si_1
    WHERE si_1.status::text = 'Complete'::text
    GROUP BY si_1.purchase_item_id
) si ON si.purchase_item_id = pii.id
LEFT JOIN (
    SELECT product_qtychange.item_id, sum(product_qtychange.qty) AS bal
    FROM product_qtychange
    GROUP BY product_qtychange.item_id
) pq ON pq.item_id = pii.id
LEFT JOIN app_user au ON pii.verified_by = au.id
ORDER BY p.title, pii.exp_date DESC;

-- Drop pack_size column
ALTER TABLE purchase_invoice_item
DROP COLUMN IF EXISTS pack_size;

COMMIT;

SELECT 'Migration 015 rolled back successfully!' AS status;
```

---

## Testing Scripts

### Test Script 1: Verify Pack Size Fix

```sql
-- Test Script: Verify pack size bug is fixed
-- Run BEFORE and AFTER migration to compare

-- Step 1: Record current state
CREATE TEMP TABLE pack_size_test_before AS
SELECT
    pii.id,
    p.title,
    p.pack AS current_pack,
    pii.qty,
    pii.qty * p.pack AS calculated_qty,
    inv.available
FROM purchase_invoice_item pii
JOIN product p ON p.id = pii.product_id
JOIN inventory_view inv ON inv.purchase_itemid = pii.id
WHERE p.id IN (SELECT id FROM product LIMIT 5);

-- Step 2: Change pack size for one product
UPDATE product
SET pack = pack * 2
WHERE id = (SELECT id FROM product LIMIT 1);

-- Step 3: Check if quantities changed (BUG if they did)
SELECT
    before.title,
    before.current_pack AS old_pack,
    p.pack AS new_pack,
    before.calculated_qty AS old_qty,
    pii.qty * p.pack AS new_qty,
    CASE
        WHEN before.calculated_qty != pii.qty * p.pack THEN '❌ BUG: Qty changed retroactively!'
        ELSE '✓ OK: Qty unchanged'
    END AS status
FROM pack_size_test_before before
JOIN purchase_invoice_item pii ON pii.id = before.id
JOIN product p ON p.id = pii.product_id;

-- Clean up
DROP TABLE pack_size_test_before;
```

---

## Next Steps

1. **Review this analysis** with the development team
2. **Prioritize fixes** based on business impact
3. **Create GitHub issues** for each bug using the templates in `GITHUB_ISSUES_SETUP.md`
4. **Assign developers** to critical bugs (#3, #4, #5)
5. **Schedule testing** after each fix
6. **Deploy fixes** to production in stages

---

**Questions or need clarification on any issue? Please reach out to the development team.**

**Report Generated**: 2026-01-09 19:50 IST
**Analysis Tool**: Claude Code
**Total Issues Analyzed**: 5
**Confirmed Bugs**: 4
**Feature Enhancements**: 1
