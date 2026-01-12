# Data Scope Testing Guide

**Date:** 2026-01-12
**Module:** Sales
**Feature:** Data Scope Filtering (all/team/self)

---

## Overview

This guide explains how to test the data scope implementation for the Sales module. Data scope controls which records a user can view based on their role permissions.

---

## Test Environment Setup

### Current Configuration

| User | Email | Password | Role | Data Scope for Sales |
|------|-------|----------|------|---------------------|
| **Admin** | admin@rgp.com | admin123 | Admin (ID: 1) | `all` (legacy permissions) |
| **Sales Staff** | staff@rgp.com | staff123 | Sales Staff (ID: 2) | `self` (feature groups) |

### Verification

Run the test script to verify configuration:

```bash
cd tests
bash test-data-scope-simple.sh
```

Expected output:
```
✓ Admin logged in successfully
✓ Staff logged in successfully

Role Configuration:
 role_id |  role_name  |  feature_group   | data_scope
---------+-------------+------------------+------------
       1 | Admin       |                  |
       2 | Sales Staff | Sales Management | self
```

---

## Testing Scenarios

### Scenario 1: Create Sales as Different Users

#### Step 1: Login to Frontend as Admin

1. Open browser: http://localhost:8000
2. Login with:
   - Email: `admin@rgp.com`
   - Password: `admin123`

#### Step 2: Create a Sale as Admin

1. Navigate to **Sales > POS** or **Sales > New**
2. Select a customer (or create new)
3. Add products to the sale
4. Complete the sale
5. **Note the Bill Number** (e.g., BILL-001)

#### Step 3: Logout and Login as Staff

1. Logout from Admin
2. Login with:
   - Email: `staff@rgp.com`
   - Password: `staff123`

#### Step 4: Create a Sale as Staff

1. Navigate to **Sales > POS** or **Sales > New**
2. Select a customer
3. Add products
4. Complete the sale
5. **Note the Bill Number** (e.g., BILL-002)

### Scenario 2: Test Data Scope Filtering

#### Test 1: Staff User Views Sales List

**Expected Behavior:** Staff should ONLY see sales they created

1. As **Staff**, navigate to **Sales > List**
2. Count the number of sales displayed
3. Verify all sales shown have your name as creator
4. You should **NOT** see the sale created by Admin

**API Test:**
```bash
# Get Staff JWT token
STAFF_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@rgp.com","password":"staff123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# List sales as Staff
curl -s -X GET http://localhost:3000/sales \
  -H "Authorization: Bearer $STAFF_TOKEN" | jq .
```

Expected: Only sales with `created_by = 4` (Staff's user ID)

#### Test 2: Admin User Views Sales List

**Expected Behavior:** Admin should see ALL sales

1. Logout and login as **Admin**
2. Navigate to **Sales > List**
3. Count the number of sales displayed
4. You should see:
   - Sales created by Admin
   - Sales created by Staff
   - **ALL sales in the system**

**API Test:**
```bash
# Get Admin JWT token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rgp.com","password":"admin123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# List sales as Admin
curl -s -X GET http://localhost:3000/sales \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

Expected: ALL sales regardless of `created_by`

### Scenario 3: Test Record-Level Access Control

#### Test 1: Staff Tries to View Their Own Sale

**Expected:** ✓ Success (200 OK)

1. As **Staff**, get the ID of a sale you created
2. Navigate to **Sales > View** or call API:

```bash
SALE_ID=<your-sale-id>

curl -s -X GET http://localhost:3000/sales/$SALE_ID \
  -H "Authorization: Bearer $STAFF_TOKEN"
```

Expected: Sale details returned successfully

#### Test 2: Staff Tries to View Admin's Sale

**Expected:** ✗ Forbidden (403)

1. As **Staff**, try to access a sale created by Admin
2. Get the sale ID from database or Admin user
3. Call API:

```bash
ADMIN_SALE_ID=<admin-sale-id>

curl -s -X GET http://localhost:3000/sales/$ADMIN_SALE_ID \
  -H "Authorization: Bearer $STAFF_TOKEN"
```

Expected Response:
```json
{
  "statusCode": 403,
  "message": "You can only access your own sales",
  "error": "Forbidden"
}
```

#### Test 3: Admin Views Any Sale

**Expected:** ✓ Success (all sales accessible)

```bash
# Admin can access Staff's sale
curl -s -X GET http://localhost:3000/sales/$STAFF_SALE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Admin can access their own sale
curl -s -X GET http://localhost:3000/sales/$ADMIN_SALE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Both should return 200 OK with sale details

---

## Automated Test Script

### Run Full Test Suite

```bash
cd tests
bash test-data-scope-simple.sh
```

### Manual Database Verification

```bash
# Connect to database
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# Check all sales with creators
SELECT id, bill_no, total, status, created_by,
  (SELECT email FROM app_user WHERE id = sale.created_by) as creator_email
FROM sale
WHERE active = true
ORDER BY created_by, id;

# Check data scope configuration
SELECT
  r.id as role_id,
  r.name as role_name,
  fg.display_name as feature_group,
  rfa.data_scope
FROM app_role r
LEFT JOIN role_feature_assignment rfa ON rfa.role_id = r.id AND rfa.active = true
LEFT JOIN feature_group fg ON fg.id = rfa.feature_group_id
WHERE r.id IN (1, 2)
ORDER BY r.id;
```

---

## Expected Results Summary

| Test Case | User | Action | Expected Result |
|-----------|------|--------|----------------|
| List all sales | Admin | GET /sales | Returns ALL sales (4 sales) |
| List all sales | Staff | GET /sales | Returns ONLY own sales (2 sales) |
| View own sale | Staff | GET /sales/{id} | 200 OK - Sale details |
| View other's sale | Staff | GET /sales/{id} | 403 Forbidden |
| View any sale | Admin | GET /sales/{id} | 200 OK - Sale details |
| Update own sale | Staff | PUT /sales | 200 OK - Updated |
| Update other's sale | Staff | PUT /sales | 403 Forbidden (on initial load) |

---

## Troubleshooting

### Issue: Staff Sees All Sales (Not Filtered)

**Possible Causes:**
1. Data scope not set to 'self' in database
2. DataScopeService not being called
3. Old API code still running

**Solution:**
```sql
-- 1. Verify data scope
SELECT data_scope FROM role_feature_assignment WHERE role_id = 2;

-- 2. Update if needed
UPDATE role_feature_assignment
SET data_scope = 'self'
WHERE role_id = 2 AND feature_group_id = 1;
```

```bash
# 3. Restart API container
docker-compose restart api

# 4. Check API logs
docker logs rgp-bo-api-1 | grep DataScope
```

### Issue: Access Denied (403) for Own Sales

**Possible Causes:**
1. User ID mismatch
2. Sale not actually created by this user

**Solution:**
```sql
-- Check who created the sale
SELECT id, bill_no, created_by FROM sale WHERE id = <sale-id>;

-- Check current user ID
SELECT id, email FROM app_user WHERE email = 'staff@rgp.com';
```

### Issue: No Sales Visible for Any User

**Possible Causes:**
1. No active sales in database
2. Permission issue prevents sales access

**Solution:**
```sql
-- Check if sales exist
SELECT COUNT(*) FROM sale WHERE active = true;

-- Check user permissions
SELECT id, email, role_id FROM app_user WHERE email IN ('admin@rgp.com', 'staff@rgp.com');
```

---

## Verifying Log Output

### Check DataScopeService Logs

```bash
docker logs rgp-bo-api-1 | grep DataScope
```

Expected log entries when Staff accesses sales:
```
[DataScopeService] Applying data scope filter: userId=4, resource=sales, scope=self
[DataScopeService] Applying 'self' (own) filter: sale.createdby = 4
[DataScopeService] Found 2 sales for user 4
```

Expected log entries when Admin accesses sales:
```
[DataScopeService] Applying data scope filter: userId=2, resource=sales, scope=all
[DataScopeService] No filter applied - user has 'all' scope
[DataScopeService] Found 4 sales for user 2
```

### Check Permission Resolution

```bash
docker logs rgp-bo-api-1 | grep PermissionService
```

---

## Performance Verification

### Query Performance

Check that data scope filtering adds minimal overhead:

```sql
-- Enable query timing
\timing on

-- Simulate Staff query (with filter)
EXPLAIN ANALYZE
SELECT * FROM sale
WHERE active = true AND created_by = 4
ORDER BY updated_on DESC;

-- Simulate Admin query (no filter)
EXPLAIN ANALYZE
SELECT * FROM sale
WHERE active = true
ORDER BY updated_on DESC;
```

Expected: Both queries should use the `idx_sale_created_by` index and execute in <10ms

---

## Next Steps

After verifying sales data scope works:

1. **Apply to Other Modules**
   - Payroll (high priority - salary data)
   - Attendance (employees see own, managers see team)
   - Leave Requests (employees see own, managers approve team)
   - Purchase Invoices (restrict by creator)

2. **Implement Team Scope**
   - Add `store_id` to `app_user` table
   - Uncomment team scope code in DataScopeService
   - Test with multi-store scenarios

3. **Add UI Indicators**
   - Show data scope badge in UI
   - Display filter status in lists
   - Add tooltips explaining scope

---

## Success Criteria

✓ **Data Scope Implementation is Successful When:**

1. Staff user can ONLY see sales they created
2. Admin user can see ALL sales
3. Staff gets 403 when trying to access other users' sales
4. Admin can access any sale
5. Logs show data scope filtering being applied
6. Query performance is not degraded
7. No errors in API logs

---

## Conclusion

The data scope implementation provides robust, backend-enforced data visibility control. This ensures users can only access data they're authorized to see, regardless of how they access the API (UI, direct API calls, or other clients).

**Status:** ✅ Infrastructure Complete - Ready for Testing with Real Data

**Documentation:**
- Implementation: `/docs/DATA_SCOPE_IMPLEMENTATION_SALES.md`
- Testing: `/docs/DATA_SCOPE_TESTING_GUIDE.md` (this file)
- Test Scripts: `/tests/test-data-scope-simple.sh`

---

**Last Updated:** 2026-01-12
**Author:** Claude Code
