# Critical Fixes Testing Guide

**Date**: 2025-01-09
**Branch**: feature/enhanced-invoice-lifecycle
**Fixes**: Issues #58, #59, #60

## Overview

This guide provides comprehensive testing procedures for three critical bug fixes implemented in the RGP Back Office system:

1. **Issue #58**: Pack Size Historical Data Bug (CRITICAL)
2. **Issue #59**: GST Tax Rate Override Bug (HIGH)
3. **Issue #60**: Bill Number Waste & Quantity Reversal Bug (HIGH)

---

## Prerequisites

### Database Access
```bash
# Connect to database
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# OR if not using Docker
psql -U rgpapp -d rgpdb -h localhost -p 5432
```

### Backup Database First
```bash
# Create backup before testing
docker exec rgp-db pg_dump -U rgpapp rgpdb > backup_before_testing_$(date +%Y%m%d).sql

# OR
pg_dump -U rgpapp -d rgpdb -h localhost > backup_before_testing_$(date +%Y%m%d).sql
```

---

## Issue #58: Pack Size Historical Data Bug

### Problem
When a product's pack size is changed, ALL historical purchase quantities are retroactively recalculated, corrupting historical data.

### Fix Applied
- Added `pack_size` column to `purchase_invoice_item` table
- Updated database views to use stored `pack_size` instead of current `product.pack`
- Updated backend service to store pack size at time of purchase

### Testing Steps

#### Step 1: Run the Migration

```bash
# Execute migration script
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/016_fix_pack_size_historical_bug.sql

# OR
psql -U rgpapp -d rgpdb -h localhost -f sql/migrations/016_fix_pack_size_historical_bug.sql
```

**Expected Output**:
```
ALTER TABLE
UPDATE [number of rows]
ALTER TABLE
CREATE OR REPLACE VIEW
CREATE OR REPLACE VIEW
```

#### Step 2: Verify Column Creation

```sql
-- Check pack_size column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_invoice_item'
AND column_name = 'pack_size';
```

**Expected Result**:
```
 column_name |     data_type      | column_default
-------------+--------------------+----------------
 pack_size   | double precision   | NULL
```

#### Step 3: Verify Data Backfill

```sql
-- Check that existing items have pack_size populated
SELECT
    COUNT(*) as total_items,
    COUNT(pack_size) as items_with_pack_size,
    COUNT(*) - COUNT(pack_size) as items_missing_pack_size
FROM purchase_invoice_item;
```

**Expected Result**: `items_missing_pack_size` should be 0

```sql
-- View sample data
SELECT
    pii.id,
    pii.product_id,
    p.title,
    p.pack as current_pack,
    pii.pack_size as historical_pack,
    pii.qty,
    pii.qty * pii.pack_size as total_units
FROM purchase_invoice_item pii
JOIN product p ON p.id = pii.product_id
ORDER BY pii.created_on DESC
LIMIT 10;
```

#### Step 4: Test Pack Size Change Doesn't Affect Historical Data

1. **Record Before State**:
```sql
-- Pick a product and record its current state
SELECT
    p.id,
    p.title,
    p.pack as current_pack_size,
    COUNT(pii.id) as total_purchases,
    SUM(pii.qty) as total_qty_purchased,
    SUM(pii.qty * pii.pack_size) as total_units_purchased
FROM product p
LEFT JOIN purchase_invoice_item pii ON pii.product_id = p.id
WHERE p.id = [SELECT_A_PRODUCT_ID]
GROUP BY p.id, p.title, p.pack;
```

2. **Change Pack Size**:
```sql
-- Example: Change pack size from 10 to 20
UPDATE product
SET pack = 20, updated_on = CURRENT_TIMESTAMP
WHERE id = [PRODUCT_ID];
```

3. **Verify Historical Data Unchanged**:
```sql
-- Re-run the same query - total_units_purchased should NOT change
SELECT
    p.id,
    p.title,
    p.pack as current_pack_size,
    COUNT(pii.id) as total_purchases,
    SUM(pii.qty) as total_qty_purchased,
    SUM(pii.qty * pii.pack_size) as total_units_purchased
FROM product p
LEFT JOIN purchase_invoice_item pii ON pii.product_id = p.id
WHERE p.id = [PRODUCT_ID]
GROUP BY p.id, p.title, p.pack;
```

**Expected Result**:
- `current_pack_size` should be 20 (new value)
- `total_qty_purchased` should be UNCHANGED
- `total_units_purchased` should be UNCHANGED (uses historical pack_size)

4. **Check Inventory View**:
```sql
-- Verify inventory_view uses stored pack_size
SELECT
    iv.purchase_itemid,
    iv.title,
    iv.batch,
    iv.qty as purchase_qty,
    iv.pack_size as historical_pack,
    iv.purchased as total_units,
    iv.available
FROM inventory_view iv
WHERE iv.product_id = [PRODUCT_ID]
ORDER BY iv.exp_date;
```

**Expected Result**: `purchased` calculation should use `historical_pack`, not current pack

#### Step 5: Test New Purchases Store Current Pack Size

1. **Create a new purchase invoice item via API or UI**
2. **Verify pack_size is stored**:
```sql
-- Check the newly created item
SELECT
    pii.id,
    pii.product_id,
    p.pack as current_pack,
    pii.pack_size as stored_pack,
    pii.qty,
    pii.created_on
FROM purchase_invoice_item pii
JOIN product p ON p.id = pii.product_id
ORDER BY pii.created_on DESC
LIMIT 1;
```

**Expected Result**: `stored_pack` should match `current_pack`

### Rollback (If Needed)

```bash
# If testing fails, rollback the migration
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/016_rollback.sql

# OR
psql -U rgpapp -d rgpdb -h localhost -f sql/migrations/016_rollback.sql
```

---

## Issue #59: GST Tax Rate Override Bug

### Problem
When selecting a batch in the invoice item form, the tax rate from the historical batch overrides the correct HSN-based tax rate.

### Fix Applied
- Removed tax rate override in `selectBatch()` function
- Added console warnings for tax rate mismatches
- Updated `loadexist()` to preserve HSN tax rate

### Testing Steps

#### Step 1: Open Invoice Item Form

1. Login to the application
2. Navigate to Purchases → Invoices
3. Create a new invoice or edit existing
4. Add a new item

#### Step 2: Test Tax Rate from Product/HSN

1. **Select a product with HSN tax rate** (e.g., a drug with 12% GST)
2. **Check browser console**: Should see log like:
   ```
   ✓ Auto-populated tax rate from HSN: 12% (MEDICINES)
   ```
3. **Verify the Tax % field is populated with 12%**

#### Step 3: Test Batch Selection Doesn't Override Tax

1. **Type a batch number** in the batch field
2. **Select a historical batch** from autocomplete dropdown
3. **Check browser console**: If historical batch has different tax rate, should see:
   ```
   ⚠ Tax rate mismatch: Batch has 5% but current HSN rate is 12%. Using current HSN rate 12%.
   ```
4. **Verify Tax % field STILL shows 12%** (not overridden to 5%)

#### Step 4: Test Load Existing Batch

1. **Select a product**
2. **Enter an existing batch number**
3. **Click "Load Existing"**
4. **Verify Tax % field maintains HSN rate** (not overridden by historical data)

#### Step 5: Save and Verify

1. **Complete all required fields**
2. **Save the invoice item**
3. **Query database to verify correct tax rate saved**:

```sql
-- Check the saved item has correct tax rate
SELECT
    pii.id,
    p.title,
    pii.batch,
    pii.tax_pcnt as saved_tax_rate,
    p.tax_pcnt as product_tax_rate,
    pii.created_on
FROM purchase_invoice_item pii
JOIN product p ON p.id = pii.product_id
ORDER BY pii.created_on DESC
LIMIT 5;
```

**Expected Result**: `saved_tax_rate` should match the HSN rate (12%), not historical batch rate (5%)

### Test Cases Matrix

| Scenario | Product HSN Rate | Batch Historical Rate | Expected Result |
|----------|------------------|----------------------|-----------------|
| New batch, HSN 12% | 12% | N/A | Save with 12% |
| Existing batch 5%, HSN now 12% | 12% | 5% | Save with 12% (current) |
| Existing batch 12%, HSN now 5% | 5% | 12% | Save with 5% (current) |
| Product without HSN | Product 18% | Batch 18% | Save with 18% |

---

## Issue #60: Bill Number Waste & Quantity Reversal Bug

### Problem
Bill numbers are generated BEFORE validation, causing:
1. Wasted bill number sequences when validation fails
2. Quantity reversals when transactions roll back

### Fix Applied
- Moved bill number generation AFTER validation in `sale.service.ts`
- Added stock availability validation before sale creation
- Added negative stock adjustment prevention in `stock.service.ts`

### Testing Steps

#### Step 1: Test Bill Number Generation Timing

**Test Case 1: Validation Failure**

1. **Create a sale via API with invalid data**:
```bash
# Missing required items
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -d '{
    "customerid": 1,
    "items": []
  }'
```

**Expected Result**:
- Sale creation should fail with error: "Sale must have at least one item"
- **NO bill number should be consumed**

2. **Check bill sequence**:
```sql
-- Check current bill number
SELECT last_value FROM bill_seq;
```

3. **Create a valid sale**:
```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -d '{
    "customerid": 1,
    "storeid": 1,
    "items": [
      {
        "productid": 1,
        "purchase_item_id": 123,
        "qty": 1,
        "price": 100,
        "total": 100
      }
    ]
  }'
```

4. **Verify bill sequence is sequential**:
```sql
-- The bill number should be last_value + 1, not +2 (no gap)
SELECT bill_no FROM sale ORDER BY created_on DESC LIMIT 1;
SELECT last_value FROM bill_seq;
```

**Expected Result**: No gaps in bill number sequence

**Test Case 2: Stock Validation Failure**

1. **Find an item with low stock**:
```sql
SELECT
    iv.purchase_itemid,
    iv.title,
    iv.batch,
    iv.available
FROM inventory_view iv
WHERE iv.available > 0 AND iv.available < 5
ORDER BY iv.available
LIMIT 1;
```

2. **Try to create sale with quantity > available**:
```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -d '{
    "customerid": 1,
    "storeid": 1,
    "items": [
      {
        "productid": [PRODUCT_ID],
        "purchase_item_id": [ITEM_ID],
        "qty": 999,
        "price": 100,
        "total": 99900
      }
    ]
  }'
```

**Expected Result**:
- Sale creation should fail with: "Insufficient stock for item. Available: X, Requested: 999"
- **NO bill number consumed**
- **NO quantity reduced in inventory**

3. **Verify inventory unchanged**:
```sql
SELECT available
FROM inventory_view
WHERE purchase_itemid = [ITEM_ID];
```

**Expected Result**: Available quantity should be unchanged

#### Step 2: Test Stock Adjustment Validation

**Test Case: Negative Adjustment Below Zero**

1. **Find an item with specific stock**:
```sql
SELECT
    iv.purchase_itemid,
    iv.title,
    iv.available
FROM inventory_view iv
WHERE iv.available > 0 AND iv.available < 10
ORDER BY iv.available
LIMIT 1;
```

2. **Try to create negative adjustment that would go below zero**:
```bash
curl -X POST http://localhost:3000/stock/qty \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -d '{
    "item_id": [ITEM_ID],
    "qty": -999,
    "reason": "Test negative adjustment"
  }'
```

**Expected Result**:
- Should fail with error: "Invalid adjustment: Cannot reduce stock below zero. Current: X, Adjustment: -999, Would result in: [NEGATIVE]"
- **NO adjustment created**
- **Inventory unchanged**

3. **Verify adjustment was rejected**:
```sql
-- Check no adjustment was created
SELECT *
FROM product_qtychange
WHERE item_id = [ITEM_ID]
ORDER BY created_on DESC
LIMIT 1;

-- Verify inventory unchanged
SELECT available
FROM inventory_view
WHERE purchase_itemid = [ITEM_ID];
```

#### Step 3: Test Transaction Atomicity

**Test Case: Complete Transaction Rollback**

This requires either:
1. Temporarily causing a database constraint violation
2. Using the existing test script

```bash
# Run the Phase 3 transaction test
cd tests
npm install  # if not already done
node test-transaction-rollback.js
```

**Expected Output**:
```
===========================================
Phase 3: Transaction Atomicity Test
===========================================

Test 1: Sale with Items (Valid Transaction)
✓ Created sale with 2 items
✓ Sale record exists in database
✓ All 2 sale items exist in database
✓ Test 1 PASSED

Test 2: Transaction Rollback on Error
✓ Transaction correctly rolled back on error
✓ No orphaned sale record
✓ No orphaned sale items
✓ Test 2 PASSED
```

### Bill Number Sequence Integrity Check

Run this comprehensive check to verify no gaps in bill numbers:

```sql
-- Check for gaps in bill number sequence
WITH bill_numbers AS (
    SELECT
        bill_no::integer as bill_num,
        LAG(bill_no::integer) OVER (ORDER BY bill_no::integer) as prev_bill_num
    FROM sale
    WHERE bill_no IS NOT NULL
    ORDER BY bill_no::integer
)
SELECT
    prev_bill_num,
    bill_num,
    bill_num - prev_bill_num as gap
FROM bill_numbers
WHERE bill_num - prev_bill_num > 1
ORDER BY bill_num;
```

**Expected Result**: Should return 0 rows (no gaps)

---

## Regression Testing

After all fixes are verified, run these regression tests to ensure no functionality broke:

### Test 1: Create Complete Sale Flow

1. Create new sale with multiple items
2. Verify bill number generated
3. Verify inventory reduced
4. Verify sale total calculated correctly
5. Verify sale items saved with correct quantities

### Test 2: Create Purchase Invoice Flow

1. Create new purchase invoice
2. Add items with batch, expiry, tax rate
3. Verify pack size stored for each item
4. Verify inventory increased
5. Change product pack size
6. Verify historical invoice still shows original pack size

### Test 3: Stock Adjustments

1. Create positive stock adjustment
2. Verify inventory increased
3. Create negative stock adjustment (within available)
4. Verify inventory decreased
5. Try negative adjustment beyond available
6. Verify rejection

### Test 4: Invoice Item Batch Selection

1. Create invoice item
2. Select product with HSN code
3. Verify tax rate populated
4. Select existing batch
5. Verify PTR, MRP, expiry populated
6. Verify tax rate NOT changed
7. Save item
8. Verify correct data in database

---

## Performance Testing

### Check Query Performance

```sql
-- Test inventory_view performance
EXPLAIN ANALYZE
SELECT * FROM inventory_view WHERE product_id = 1;

-- Test product_items_view performance
EXPLAIN ANALYZE
SELECT * FROM product_items_view WHERE id = 1;
```

**Expected**: Query times should be similar to before migration (< 100ms for single product)

### Check Index Usage

```sql
-- Verify indexes are being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM purchase_invoice_item WHERE product_id = 1;
```

---

## Sign-Off Checklist

Before deploying to production, verify:

### Issue #58 - Pack Size Fix
- [ ] Migration script ran successfully
- [ ] All purchase_invoice_item records have pack_size populated
- [ ] Changing product pack size does NOT change historical quantities
- [ ] New purchases store current pack size
- [ ] inventory_view uses stored pack_size
- [ ] product_items_view uses stored pack_size
- [ ] No performance degradation

### Issue #59 - Tax Rate Fix
- [ ] Product selection populates HSN tax rate
- [ ] Batch selection does NOT override tax rate
- [ ] Console warnings appear for tax rate mismatches
- [ ] Load existing batch preserves HSN tax rate
- [ ] Saved items have correct current tax rate
- [ ] Historical items retain their original tax rate

### Issue #60 - Bill Number & Quantity Fix
- [ ] Validation failures do NOT consume bill numbers
- [ ] No gaps in bill number sequence
- [ ] Stock validation prevents overselling
- [ ] Negative stock adjustments rejected if would go below zero
- [ ] Transaction rollback properly reverts all changes
- [ ] No orphaned sale records
- [ ] No orphaned sale items

### General
- [ ] All regression tests pass
- [ ] No errors in application logs
- [ ] No errors in database logs
- [ ] Performance acceptable
- [ ] Database backup taken before deployment
- [ ] Rollback scripts tested and ready

---

## Rollback Plan

If issues are discovered after deployment:

### Issue #58 Rollback
```bash
# Rollback pack size migration
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/016_rollback.sql

# Revert code changes
git revert [COMMIT_HASH]
git push
```

### Issues #59 & #60 Rollback
```bash
# Revert code changes
git revert [COMMIT_HASH]
git push

# Redeploy previous version
cd api-v2
npm run build
# Restart service
```

---

## Support & Troubleshooting

### Common Issues

**Pack size not populated for new items**
- Check: `api-v2/src/modules/app/purchases/purchase-invoice.service.ts` line ~180
- Verify: Product repository is injected and product is fetched

**Tax rate still being overridden**
- Check: Browser console for warnings
- Check: `frontend/src/app/secured/purchases/invoices/components/invoice-item-form.component.ts`
- Verify: selectBatch() does NOT have `this.form.controls['taxpcnt'].setValue()`

**Bill numbers still have gaps**
- Check: `api-v2/src/modules/app/sales/sale.service.ts` line ~40
- Verify: Validation happens BEFORE `generate_bill_number()` call
- Check: Application logs for error patterns

### Log Locations

**Application Logs**:
```bash
docker logs rgp-bo-api-1 --tail 100 -f
```

**Database Logs**:
```bash
docker logs rgp-db --tail 100 -f
```

**Frontend Console**:
- Open browser developer tools (F12)
- Check Console tab for warnings

---

## Contact

For issues or questions regarding these fixes:
- GitHub Issues: #58, #59, #60
- Documentation: `docs/BUG_ANALYSIS_REPORTED_ISSUES.md`

**Tested By**: _________________
**Test Date**: _________________
**Environment**: [ ] Staging [ ] Production
**Status**: [ ] Pass [ ] Fail [ ] Partial

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
