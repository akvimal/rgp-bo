# Phase 3: Transaction Rollback Testing Guide

This guide provides instructions for testing the transaction wrappers implemented in Phase 3.

---

## Automated Tests

### Running the Test Suite

```bash
cd tests
npm install pg  # If not already installed
node test-transaction-rollback.js
```

### Expected Output

```
=============================================================
RGP Back Office - Transaction Rollback Tests
=============================================================

--- Test 1: Sale Creation Rollback ---
Initial bill number: 1234
Expected next bill: 1235
Generated bill number: 1235
Created sale ID: 567
Transaction rolled back: ...
✅ PASS: Sale Creation Rollback
   No orphaned sale found. Next bill: 1235

--- Test 2: Purchase Invoice Deletion Rollback ---
Created test invoice ID: 89
Created test item ID: 123
Deletion rolled back: Simulated failure during deletion
✅ PASS: Purchase Invoice Deletion Rollback
   Invoice and items preserved after rollback
Test data cleaned up

--- Test 3: Check for Orphaned Sale Items ---
✅ PASS: No Orphaned Sale Items
   Database is clean - no orphaned items found

--- Test 4: Check for Orphaned Invoice Items ---
✅ PASS: No Orphaned Invoice Items
   Database is clean - no orphaned items found

--- Test 5: Bill Number Sequence Integrity ---
✅ PASS: Bill Number Sequence Integrity
   Last 10 bill numbers are unique: 1225, 1226, 1227, ...

=============================================================
TEST SUMMARY
=============================================================
Total Tests: 5
Passed: 5 ✅
Failed: 0 ❌
=============================================================

🎉 All tests passed! Transaction rollback is working correctly.
```

---

## Manual Testing Scenarios

### Scenario 1: Sale Creation with Invalid Item

**Purpose:** Verify sale header rolls back when item save fails

**Steps:**

1. Start the API server:
   ```bash
   cd api-v2
   npm run start:dev
   ```

2. Use Postman/curl to create a sale with invalid product:
   ```bash
   curl -X POST http://localhost:3000/api/sales \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "customerId": 1,
       "status": "PENDING",
       "items": [
         {
           "productId": 99999,
           "purchaseItemId": 99999,
           "qty": 1,
           "price": 100
         }
       ]
     }'
   ```

3. Expected Result:
   - ❌ Request returns error (500 or 400)
   - ✅ **No sale header saved** (check database)
   - ✅ **Bill number NOT consumed** (next sale gets sequential number)

4. Verify in database:
   ```sql
   -- Check for orphaned sales (should return 0 rows)
   SELECT s.* FROM sale s
   LEFT JOIN sale_item si ON si.sale_id = s.id
   WHERE si.id IS NULL AND s.bill_no IS NOT NULL;
   ```

---

### Scenario 2: Purchase Invoice Deletion Failure

**Purpose:** Verify cascade delete is atomic

**Steps:**

1. Create a test invoice with items via the API

2. Modify the database to create a constraint:
   ```sql
   -- Add a dependent record that prevents deletion
   INSERT INTO product_price (item_id, start_date, end_date, price)
   SELECT id, CURRENT_DATE, CURRENT_DATE + 30, 100
   FROM purchase_invoice_item
   WHERE invoice_id = YOUR_TEST_INVOICE_ID
   LIMIT 1;
   ```

3. Try to delete the invoice via API:
   ```bash
   curl -X DELETE http://localhost:3000/api/purchases/YOUR_TEST_INVOICE_ID \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. Expected Result:
   - ❌ Request returns error
   - ✅ **Invoice header still exists**
   - ✅ **Invoice items still exist**
   - ✅ **Product prices still exist**
   - ✅ **No partial deletion**

---

### Scenario 3: Network Interruption During Transaction

**Purpose:** Verify rollback on connection failure

**Steps:**

1. Start creating a sale via API

2. During the request, simulate network interruption:
   - Stop PostgreSQL service mid-transaction
   - Or kill the database connection

3. Expected Result:
   - ❌ Request times out or errors
   - ✅ **Transaction automatically rolled back**
   - ✅ **No orphaned data**

4. Restart database and verify:
   ```sql
   -- Should return 0 rows
   SELECT * FROM sale WHERE created_on > NOW() - INTERVAL '1 minute';
   ```

---

## Database Integrity Checks

Run these queries to verify database integrity:

### Check 1: Orphaned Sale Items
```sql
SELECT COUNT(*) as orphaned_items
FROM sale_item si
LEFT JOIN sale s ON s.id = si.sale_id
WHERE s.id IS NULL;

-- Expected: 0
```

### Check 2: Orphaned Invoice Items
```sql
SELECT COUNT(*) as orphaned_items
FROM purchase_invoice_item pii
LEFT JOIN purchase_invoice pi ON pi.id = pii.invoice_id
WHERE pi.id IS NULL;

-- Expected: 0
```

### Check 3: Sales Without Items
```sql
SELECT s.id, s.bill_no, s.created_on
FROM sale s
LEFT JOIN sale_item si ON si.sale_id = s.id
WHERE si.id IS NULL
  AND s.status != 'CANCELLED'
  AND s.bill_no IS NOT NULL;

-- Expected: 0 rows (unless legitimately empty)
```

### Check 4: Bill Number Duplicates
```sql
SELECT bill_no, COUNT(*) as count
FROM sale
WHERE bill_no IS NOT NULL
GROUP BY bill_no
HAVING COUNT(*) > 1;

-- Expected: 0 rows
```

### Check 5: Transaction Isolation Test
```sql
-- Run in two separate sessions simultaneously:

-- Session 1:
BEGIN;
SELECT generate_bill_number();
-- Wait 5 seconds before committing

-- Session 2 (while Session 1 is waiting):
SELECT generate_bill_number();
-- Should wait for Session 1 to commit (due to FOR UPDATE lock)

-- Expected: Session 2 gets next sequential number after Session 1 commits
```

---

## Performance Testing

### Concurrent Transaction Test

Test how the system handles multiple concurrent sales:

```bash
# Install Apache Bench or similar
# Send 100 concurrent requests to create sales

ab -n 100 -c 10 -T 'application/json' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -p sale_payload.json \
  http://localhost:3000/api/sales
```

**Monitor:**
- Response times (should be < 500ms per transaction)
- Error rate (should be 0%)
- Bill number sequence (should be sequential, no gaps except on errors)

---

## Troubleshooting

### Test Fails: "Orphaned sale found"

**Cause:** Transaction didn't rollback properly

**Check:**
1. Verify NestJS version supports transactions
2. Check database logs for errors
3. Verify TypeORM configuration
4. Ensure SERIALIZABLE isolation is supported

### Test Fails: "Bill numbers are not unique"

**Cause:** Phase 2 locking not working

**Fix:**
1. Apply Phase 2 migration: `psql -f sql/migrations/002_fix_bill_number_race_condition.sql`
2. Verify `SELECT FOR UPDATE` is in place

### Performance Degradation

**Cause:** SERIALIZABLE isolation causing waits

**Options:**
1. Accept the performance trade-off (recommended for accounting system)
2. Switch to READ COMMITTED (less safe, not recommended)
3. Optimize transaction duration

---

## Success Criteria

✅ All automated tests pass
✅ No orphaned sale items in database
✅ No orphaned invoice items in database
✅ Bill numbers are unique and sequential
✅ Failed transactions don't consume bill numbers
✅ Partial commits never occur
✅ Performance acceptable (< 500ms per transaction)

---

## Next Steps After Testing

1. If tests pass → Move to Phase 4 (Error Handling)
2. If tests fail → Debug and fix issues before proceeding
3. Document any edge cases discovered during testing
4. Consider adding integration tests to CI/CD pipeline
