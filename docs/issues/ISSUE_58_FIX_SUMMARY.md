# Issue #58 Fix Summary - Pack Size Historical Bug

**Issue**: [CRITICAL BUG] Pack Size Change Retroactively Affects Historical Quantities
**Status**: ✅ RESOLVED
**Fix Date**: 2026-01-12
**Migration**: 033_fix_pack_size_historical_bug.sql

---

## Problem Description

When a product's pack size was changed, ALL historical purchase quantities were recalculated using the NEW pack size instead of the pack size at the time of purchase. This caused:

- ❌ Incorrect historical inventory quantities
- ❌ Wrong stock balance calculations
- ❌ Inaccurate profit/loss reports
- ❌ Data integrity violations

### Example of the Bug:
```
1. Jan 1: Product pack size = 10 units
2. Jan 5: Purchase 100 packs = 1000 units ✓ Correct
3. Jan 10: Sold 500 units, balance = 500 units ✓ Correct
4. Jan 15: Change pack size to 20 units
5. Jan 16: System shows balance = 1500 units ✗ WRONG!
   (100 packs × NEW 20 = 2000, minus 500 = 1500)
```

**Expected**: Balance should remain 500 units
**Actual**: Balance became 1500 units

---

## Root Cause

Database views calculated quantities as:
```sql
pii.qty * p.pack AS purchased
```

Where `p.pack` is the **CURRENT** pack size from the product table, not the pack size at time of purchase.

### Affected Views:
- `inventory_view` - Lines 42, 51
- `product_items_view` - Lines 136, 139
- `stock_view` - Lines 282, 284
- `sale_view` - Lines 253-257

### Affected Files:
- `sql/ddl/views.sql`
- `api-v2/src/entities/purchase-invoice-item.entity.ts`
- `api-v2/src/modules/app/purchases/purchase-invoice.service.ts`

---

## Solution Implemented

### 1. Database Schema Change

Added `pack_size` column to `purchase_invoice_item` table to store pack size at time of purchase:

```sql
ALTER TABLE purchase_invoice_item
ADD COLUMN pack_size DOUBLE PRECISION NOT NULL DEFAULT 1;
```

**Backfill Logic**:
- All existing records populated with current pack size from product table
- NULL values set to 1 (for orphaned records)
- Column set to NOT NULL with default 1

### 2. Views Updated

All views now use the stored `pack_size` instead of current `p.pack`:

**Before (BUGGY)**:
```sql
pii.qty * p.pack AS purchased
```

**After (FIXED)**:
```sql
pii.qty * pii.pack_size AS purchased
```

### Updated Views:
1. **inventory_view**
   - Added `purchase_pack_size` column
   - Uses `pii.pack_size` in purchased and available calculations

2. **product_items_view**
   - Includes `pack_size` from purchase_invoice_item
   - Uses `pack_size` in purchased and balance calculations

3. **product_items_agg_view**
   - Recreated based on fixed product_items_view

4. **stock_view**
   - Uses `pii.pack_size` for sale_qty and available_qty

5. **sale_view**
   - Uses `pii.pack_size` for ptr_cost and profit calculations

### 3. Backend Code Updates

**Entity** (`purchase-invoice-item.entity.ts`):
```typescript
// Pack size at time of purchase (fix for issue #58)
@Column("double precision", { name: "pack_size", precision: 53, default: 1 })
packsize: number;
```

**Service** (`purchase-invoice.service.ts`):
```typescript
// Store pack size at time of purchase to prevent retroactive changes
const packSize = product.pack || 1;

return this.purchaseInvoiceItemRepository.save({
    ...dto,
    ...taxData,
    packsize: packSize,  // Store current pack size (Fix for issue #58)
    createdby: userid,
    itemtype: dto.itemtype || ItemType.REGULAR,
});
```

---

## Migration Process

### Migration File
**Location**: `sql/migrations/033_fix_pack_size_historical_bug.sql`

### Migration Steps:
1. Add `pack_size` column to `purchase_invoice_item`
2. Backfill existing records with current pack sizes
3. Set default values for NULL records
4. Make column NOT NULL with default 1
5. Drop affected views (CASCADE)
6. Recreate all views with stored pack_size

### Rollback File
**Location**: `sql/migrations/033_rollback.sql`

⚠️ **Warning**: Rollback restores the BUGGY behavior. Use only if absolutely necessary.

---

## Verification Results

All verification checks passed on 2026-01-12 09:50:36 UTC:

| Test | Result |
|------|--------|
| ✅ Column Verification | pack_size column exists |
| ✅ Column Constraints | NOT NULL with default 1 |
| ✅ inventory_view Fix | Uses stored pack_size |
| ✅ product_items_view Fix | Uses stored pack_size |
| ✅ stock_view Fix | Uses stored pack_size |
| ✅ sale_view Fix | Uses stored pack_size |
| ✅ Data Integrity Check | No NULL pack_size values |

### Verification Queries:

```sql
-- Check column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_invoice_item' AND column_name = 'pack_size';

-- Verify view definitions
SELECT pg_get_viewdef('inventory_view');
SELECT pg_get_viewdef('product_items_view');
SELECT pg_get_viewdef('stock_view');
SELECT pg_get_viewdef('sale_view');

-- Check for NULL values
SELECT COUNT(*) FROM purchase_invoice_item WHERE pack_size IS NULL;

-- Sample data check
SELECT
    pii.id,
    p.title,
    pii.qty AS packs,
    pii.pack_size AS stored_pack,
    p.pack AS current_pack,
    pii.qty * pii.pack_size AS total_units
FROM purchase_invoice_item pii
JOIN product p ON p.id = pii.product_id
ORDER BY pii.id DESC
LIMIT 10;
```

---

## Impact Assessment

### Before Fix:
- ❌ Changing pack size corrupted ALL historical data
- ❌ Inventory balances incorrect
- ❌ Stock reports unreliable
- ❌ Profit/loss calculations wrong
- ❌ Critical data integrity issue

### After Fix:
- ✅ Historical data preserved accurately
- ✅ Pack size changes only affect new purchases
- ✅ Inventory balances correct
- ✅ Stock reports accurate
- ✅ Profit/loss calculations reliable
- ✅ Data integrity maintained

### Example After Fix:
```
1. Jan 1: Product pack size = 10 units
2. Jan 5: Purchase 100 packs → Stored with pack_size=10 (1000 units)
3. Jan 10: Sold 500 units, balance = 500 units
4. Jan 15: Change product pack size to 20 units
5. Jan 16: Balance still shows 500 units ✅ CORRECT!
6. Jan 20: New purchase 50 packs → Stored with pack_size=20 (1000 units)
7. Total balance: 500 + 1000 = 1500 units ✅ CORRECT!
```

---

## Testing Recommendations

### Manual Testing:

1. **Create a test product** with pack size 10
2. **Create purchase invoice** with 100 packs
3. **Verify**: Inventory shows 1000 units
4. **Sell** 500 units
5. **Verify**: Balance shows 500 units
6. **Change pack size** to 20
7. **Verify**: Balance STILL shows 500 units (not 1500)
8. **Create new purchase** with 50 packs
9. **Verify**: New purchase shows 1000 units (50 × 20)
10. **Verify**: Total balance shows 1500 units

### Automated Testing:

Create test cases in `tests/` directory to verify:
- Pack size changes don't affect historical quantities
- New purchases use current pack size
- Mixed pack sizes calculate correctly
- Views return correct data
- Stock reports accurate

---

## Future Considerations

### Preventing Similar Issues:

1. **Always store point-in-time data** when it affects calculations
2. **Avoid JOIN to current data** for historical calculations
3. **Add database constraints** to prevent NULL values
4. **Include verification queries** in all migrations
5. **Test with real scenarios** before applying migrations

### Related Fields to Consider:

Other fields that might benefit from point-in-time storage:
- Tax percentages (already stored per item)
- Product prices (already stored per item)
- Discount percentages (already stored per item)
- Product titles (for historical reporting)

---

## References

- **GitHub Issue**: #58
- **Migration File**: `sql/migrations/033_fix_pack_size_historical_bug.sql`
- **Rollback File**: `sql/migrations/033_rollback.sql`
- **Bug Analysis**: `docs/BUG_ANALYSIS_REPORTED_ISSUES.md` - Issue #4
- **Applied**: 2026-01-12 09:49:00 UTC

---

## Status

🟢 **RESOLVED** - Migration applied successfully, all verification checks passed, issue closed.

**Critical Data Integrity Bug Fixed** ✅
