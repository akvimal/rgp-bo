# Manual Verification Guide for Phases 1-3

## Overview

This guide provides step-by-step instructions to manually verify all fixes from Phases 1, 2, and 3 without requiring automated test execution.

**Use this guide when:** Direct database access via the `pg` module is not configured (pg_hba.conf authentication issues).

---

## Phase 1: SQL Injection Fixes Verification

### Method 1: Code Review (5 minutes)

All SQL injection fixes follow a consistent pattern. Verify the changes are in place:

#### 1.1 Check sale.service.ts

```bash
# Location: api-v2/src/modules/app/sales/sale.service.ts
```

**Verification Points:**

| Line | Before (Vulnerable) | After (Fixed) | Status |
|------|---------------------|---------------|---------|
| 84 | `where s.id = ${id}` | `where s.id = $1` with `[id]` parameter | ✅ |
| 162 | `where si.sale_return_id = ${id}` | `where si.sale_return_id = $1` with `[id]` | ✅ |
| 184-206 | Date string concatenation | Parameterized with $1, $2 | ✅ |

**How to verify:**
```bash
# Search for vulnerable patterns (should return 0 results):
cd api-v2
grep -n "query.*\${" src/modules/app/sales/sale.service.ts
# Expected: No matches (all fixed)

# Search for fixed patterns (should find multiple):
grep -n "\$1" src/modules/app/sales/sale.service.ts
# Expected: Multiple matches showing parameterized queries
```

#### 1.2 Check stock.service.ts

```bash
# Location: api-v2/src/modules/app/stock/stock.service.ts
```

**Verification:**
- Line 19: Array injection fixed with dynamic placeholders
- Lines 28-58: Dynamic query building uses parameterized queries
- No string interpolation `${}` in SQL queries

```bash
grep -n "query.*\${" src/modules/app/stock/stock.service.ts
# Expected: No matches
```

#### 1.3 Check customer.service.ts

```bash
# Location: api-v2/src/modules/app/customers/customer.service.ts
```

**Key verification:** Property whitelist added around line 46

```typescript
const allowedProps = ['name', 'mobile', 'email', 'address'];
if(!allowedProps.includes(c.property)){
    throw new Error(`Invalid property: ${c.property}`);
}
```

**Verify:**
```bash
grep -A 3 "allowedProps = \[" src/modules/app/customers/customer.service.ts
# Expected: Should show whitelist array
```

#### 1.4 Check saleitem.service.ts & purchase-invoice.service.ts

Both files should have no `${}` interpolation in SQL queries:

```bash
grep -n "query.*\${" src/modules/app/returns/saleitem.service.ts
grep -n "query.*\${" src/modules/app/purchases/purchase-invoice.service.ts
# Expected: No matches for either
```

### Method 2: Git Diff Review (2 minutes)

```bash
git show 64caee729 --stat
# Shows all files changed in Phase 1 commit

git show 64caee729
# Shows detailed diff of all SQL injection fixes
```

**Expected output:** 32 instances of `${}` replaced with `$1, $2, etc.`

---

## Phase 2: Bill Number Race Condition Verification

### Method 1: Check Function Code (1 minute)

```bash
# Location: sql/ddl/functions.sql
# Check line 18 for FOR UPDATE clause
```

**Open the file and verify:**

```sql
-- Around line 18, should see:
SELECT fiscal_year_start, last_bill_no INTO current_fiscal_year_start, current_bill_no
FROM sales_meta
ORDER BY fiscal_year_start DESC
LIMIT 1
FOR UPDATE;  -- THIS LINE IS CRITICAL!
```

**Verify from command line:**
```bash
grep -A 2 "FROM sales_meta" sql/ddl/functions.sql | grep "FOR UPDATE"
# Expected output: FOR UPDATE;
```

### Method 2: Database Function Inspection (if you have psql/pgAdmin access)

```sql
-- Connect to database and check function source:
\df+ generate_bill_number

-- Or view function:
SELECT prosrc FROM pg_proc WHERE proname = 'generate_bill_number';
```

**Look for:** `FOR UPDATE` in the SELECT statement from sales_meta

### Method 3: Git Commit Review

```bash
git show 54e471473
# Shows the Phase 2 commit with FOR UPDATE addition
```

---

## Phase 3: Transaction Wrappers Verification

### Method 1: Code Inspection (5 minutes)

#### 3.1 Verify sale.service.ts create() method

```bash
# Location: api-v2/src/modules/app/sales/sale.service.ts
# Lines: 20-62
```

**Check for transaction wrapper:**

```typescript
async create(sale:any,userid:any) {
    return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        try {
            // All operations use transactionManager
            // ...
        } catch (error) {
            throw new Error(`Failed to create sale: ${error.message}`);
        }
    });
}
```

**Verify from command line:**
```bash
grep -A 5 "async create(sale" src/modules/app/sales/sale.service.ts | grep "transaction('SERIALIZABLE'"
# Expected: Should find the transaction wrapper
```

#### 3.2 Verify sale.service.ts updateSale() method

```bash
# Lines: 77-112
```

**Verify:**
```bash
grep -A 5 "async updateSale" src/modules/app/sales/sale.service.ts | grep "transaction('SERIALIZABLE'"
# Expected: Should find the transaction wrapper
```

#### 3.3 Verify purchase-invoice.service.ts remove() method

```bash
# Location: api-v2/src/modules/app/purchases/purchase-invoice.service.ts
# Lines: 66-95
```

**Verify:**
```bash
grep -A 5 "async remove" src/modules/app/purchases/purchase-invoice.service.ts | grep "transaction('SERIALIZABLE'"
# Expected: Should find the transaction wrapper
```

### Method 2: Git Commit Review

```bash
git show 9b557a33f
# Shows all transaction wrapper additions
```

**Look for:**
- `.manager.transaction('SERIALIZABLE', async (transactionManager) =>`
- All database operations using `transactionManager` instead of `this.manager`
- try-catch blocks for proper error handling

---

## Integration Testing via API

If you want to functionally test the fixes work correctly:

### Test 1: Transaction Rollback (Phase 3)

**Objective:** Verify failed sale creation doesn't leave orphaned data

**Steps:**

1. **Start the API:**
   ```bash
   cd api-v2
   npm run start:dev
   ```

2. **Note current bill number:**
   - Go to pgAdmin or psql
   - Run: `SELECT MAX(bill_no) FROM sale;`
   - Note the value (e.g., 1250)

3. **Create sale with invalid product (should fail):**
   ```bash
   curl -X POST http://localhost:3000/api/sales \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "customerId": 1,
       "status": "PENDING",
       "items": [{
         "productId": 99999,
         "purchaseItemId": 99999,
         "qty": 1,
         "price": 100
       }]
     }'
   ```

4. **Expected result:**
   - API returns error (500 or 400)
   - Request fails

5. **Verify in database:**
   ```sql
   -- Check no orphaned sale was created:
   SELECT s.* FROM sale s
   LEFT JOIN sale_item si ON si.sale_id = s.id
   WHERE si.id IS NULL AND s.bill_no IS NOT NULL
   AND s.created_on > NOW() - INTERVAL '5 minutes';
   -- Expected: 0 rows

   -- Check bill number wasn't wasted:
   SELECT MAX(bill_no) FROM sale;
   -- Expected: Still 1250 (or whatever you noted earlier)
   ```

**✅ PASS if:** No orphaned sale found and bill number unchanged

### Test 2: Bill Number Concurrency (Phase 2)

**Objective:** Verify no duplicate bill numbers

**Steps:**

1. **Check for duplicates:**
   ```sql
   SELECT bill_no, COUNT(*) as count
   FROM sale
   WHERE bill_no IS NOT NULL
   GROUP BY bill_no
   HAVING COUNT(*) > 1;
   ```

2. **Expected result:** 0 rows

3. **Create several sales in rapid succession** (if possible via your frontend or Postman)

4. **Re-check for duplicates** using the same query

**✅ PASS if:** No duplicate bill numbers found

### Test 3: SQL Injection Protection (Phase 1)

**Objective:** Verify parameterized queries prevent injection

**Note:** This is inherently verified by code review. SQL injection can't occur when using parameterized queries.

**If you want to test functionally:**

1. Try to inject SQL via API endpoints that use customer search:
   ```bash
   curl -X GET "http://localhost:3000/api/customers?name=test' OR '1'='1" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Expected behavior:**
   - Returns only customers matching "test' OR '1'='1" literally
   - Does NOT return all customers (which would indicate injection)

**✅ PASS if:** Injection attempt is treated as literal string

---

## Database-Only Verification (No API needed)

If you have access to pgAdmin, psql, or any PostgreSQL client:

### SQL Script 1: Check Orphaned Data

```sql
-- Check for orphaned sale items:
SELECT COUNT(*) as orphaned_sale_items
FROM sale_item si
LEFT JOIN sale s ON s.id = si.sale_id
WHERE s.id IS NULL;
-- Expected: 0

-- Check for orphaned invoice items:
SELECT COUNT(*) as orphaned_invoice_items
FROM purchase_invoice_item pii
LEFT JOIN purchase_invoice pi ON pi.id = pii.invoice_id
WHERE pi.id IS NULL;
-- Expected: 0
```

### SQL Script 2: Check Bill Number Integrity

```sql
-- Check for duplicate bill numbers:
SELECT bill_no, COUNT(*) as count
FROM sale
WHERE bill_no IS NOT NULL
GROUP BY bill_no
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Check bill number sequence (last 10):
SELECT bill_no
FROM sale
WHERE bill_no IS NOT NULL
ORDER BY bill_no DESC
LIMIT 10;
-- Expected: Sequential numbers (e.g., 1250, 1249, 1248, ...)
```

### SQL Script 3: Verify Function Has Locking

```sql
-- Check generate_bill_number function source:
SELECT prosrc
FROM pg_proc
WHERE proname = 'generate_bill_number';
-- Expected: Should contain "FOR UPDATE" in the source code
```

---

## Verification Checklist

Use this checklist to confirm all phases are properly implemented:

### Phase 1: SQL Injection Fixes

- [ ] No `${}` string interpolation in sale.service.ts
- [ ] No `${}` string interpolation in stock.service.ts
- [ ] No `${}` string interpolation in customer.service.ts
- [ ] No `${}` string interpolation in saleitem.service.ts
- [ ] No `${}` string interpolation in purchase-invoice.service.ts
- [ ] Property whitelist exists in customer.service.ts (line ~46)
- [ ] All queries use `$1, $2, etc.` with parameter arrays
- [ ] Commit `64caee729` shows 32 vulnerability fixes

### Phase 2: Bill Number Race Condition

- [ ] `FOR UPDATE` clause exists in sql/ddl/functions.sql (line ~18)
- [ ] NULL check added for first-time initialization
- [ ] Migration script created: sql/migrations/002_fix_bill_number_race_condition.sql
- [ ] No duplicate bill numbers in database (SQL check passes)
- [ ] Commit `54e471473` shows FOR UPDATE addition

### Phase 3: Transaction Wrappers

- [ ] sale.service.ts `create()` uses `.manager.transaction('SERIALIZABLE')` (line ~20)
- [ ] sale.service.ts `updateSale()` uses transaction wrapper (line ~77)
- [ ] purchase-invoice.service.ts `remove()` uses transaction wrapper (line ~66)
- [ ] All operations within transactions use `transactionManager`
- [ ] Try-catch blocks present for error handling
- [ ] No orphaned sale items in database (SQL check passes)
- [ ] No orphaned invoice items in database (SQL check passes)
- [ ] Commits `9b557a33f` and `8612ba5e1` show transaction additions

### Overall

- [ ] All 5 commits present in fix/sql-injection branch
- [ ] No compilation errors when building the project
- [ ] API starts successfully and connects to database
- [ ] All verification SQL queries pass
- [ ] Code review shows consistent parameterization pattern

---

## Quick Verification Commands

**Run all checks at once:**

```bash
echo "=== Phase 1: SQL Injection Check ==="
cd api-v2/src/modules/app
grep -r "query.*\${" sales/sale.service.ts stock/stock.service.ts customers/customer.service.ts returns/saleitem.service.ts purchases/purchase-invoice.service.ts && echo "❌ FOUND VULNERABILITIES" || echo "✅ NO VULNERABILITIES FOUND"

echo "\n=== Phase 2: FOR UPDATE Check ==="
cd ../../../sql/ddl
grep "FOR UPDATE" functions.sql && echo "✅ FOUND" || echo "❌ NOT FOUND"

echo "\n=== Phase 3: Transaction Wrapper Check ==="
cd ../../api-v2/src/modules/app
grep -A 2 "async create(sale" sales/sale.service.ts | grep "transaction('SERIALIZABLE'" && echo "✅ FOUND in create()" || echo "❌ NOT FOUND in create()"
grep -A 2 "async remove" purchases/purchase-invoice.service.ts | grep "transaction('SERIALIZABLE'" && echo "✅ FOUND in remove()" || echo "❌ NOT FOUND in remove()"
```

**Check all commits:**

```bash
git log --oneline --grep="Phase" fix/sql-injection
# Expected: 3 commits with Phase 1, 2, and 3
```

---

## If All Checks Pass

Congratulations! Phases 1-3 are fully implemented and verified. You can proceed with:

1. **Create Pull Request:** Merge `fix/sql-injection` into `revamp` branch
2. **Deploy to Staging:** Test in staging environment
3. **Move to Phase 4:** Begin "Comprehensive Error Handling"

---

## If Checks Fail

If any verification step fails:

1. Check the specific file and line number mentioned
2. Review the git commit for that phase
3. Compare with the examples in this guide
4. Fix any discrepancies
5. Re-run verification

For help, see:
- `PHASES_1-3_COMPLETION_SUMMARY.md` - Detailed implementation summary
- Git commits - Reference implementation
- `tests/CONFIGURATION_GUIDE.md` - Troubleshooting guide

---

**Last Updated:** October 17, 2025
**Branch:** fix/sql-injection
**Status:** Ready for Verification
