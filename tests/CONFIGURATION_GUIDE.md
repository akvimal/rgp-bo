# Test Suite Configuration Guide

## Overview

This guide helps you configure and run the automated test suites for Phases 2 and 3 of the RGP Back Office improvement plan.

---

## Prerequisites

1. **Node.js** installed
2. **PostgreSQL** running and accessible
3. **Database** `rgpdb` created with RGP schema
4. **pg module** installed: `npm install pg`

---

## Database Connection Configuration

### Current Issue

The tests require a direct PostgreSQL connection using the `pg` module. If you encounter authentication errors:

```
error: password authentication failed for user "rgpapp"
```

This typically means one of the following:

1. **Credentials Mismatch**: The password in `test-config.js` doesn't match your PostgreSQL setup
2. **Authentication Method**: PostgreSQL's `pg_hba.conf` requires different authentication
3. **User Doesn't Exist**: The `rgpapp` user hasn't been created in your PostgreSQL instance

### Solution Steps

#### Step 1: Update test-config.js

Edit `tests/test-config.js` with your actual database credentials:

```javascript
module.exports = {
    // Update this with your actual database connection string
    connectionString: 'postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/rgpdb',

    // Or update individual parameters:
    user: 'YOUR_USERNAME',
    password: 'YOUR_PASSWORD',
    database: 'rgpdb',
    host: 'localhost',
    port: 5432,

    // Keep these as-is
    max: 10,
    ssl: false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
};
```

#### Step 2: Verify PostgreSQL Authentication

Check your `pg_hba.conf` file (typically in `PostgreSQL/data/pg_hba.conf`):

```
# IPv4 local connections should allow password authentication:
host    all             all             127.0.0.1/32            md5
```

If the method is `trust`, you won't need a password. If it's `peer`, password auth won't work on the same machine.

#### Step 3: Test Database Connection

Before running the full test suite, verify your connection works:

```bash
# Create a simple test file: test-connection.js
const { Pool } = require('pg');
const config = require('./test-config');

async function testConnection() {
    const pool = new Pool({
        connectionString: config.connectionString,
        ssl: config.ssl,
    });

    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful!');
        console.log('Server time:', result.rows[0].now);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    } finally {
        await pool.end();
    }
}

testConnection();
```

Run it:
```bash
cd tests
node test-connection.js
```

#### Step 4: Alternative - Use Environment Variables

You can also use environment variables instead of modifying `test-config.js`:

**Windows:**
```bash
set DATABASE_URL=postgresql://username:password@localhost:5432/rgpdb
node test-transaction-rollback.js
```

**Linux/Mac:**
```bash
export DATABASE_URL=postgresql://username:password@localhost:5432/rgpdb
node test-transaction-rollback.js
```

---

## Running the Tests

Once database connection is configured:

### Phase 2: Bill Number Race Condition Test

```bash
cd tests
node test-bill-number-concurrency.js
```

**Expected Output:**
```
✅ SUCCESS: No race condition detected!
All bill numbers are unique and sequential.
```

### Phase 3: Transaction Rollback Tests

```bash
cd tests
node test-transaction-rollback.js
```

**Expected Output:**
```
✅ PASS: Sale Creation Rollback
✅ PASS: Purchase Invoice Deletion Rollback
✅ PASS: No Orphaned Sale Items
✅ PASS: No Orphaned Invoice Items
✅ PASS: Bill Number Sequence Integrity

Total Tests: 5
Passed: 5 ✅
Failed: 0 ❌

🎉 All tests passed! Transaction rollback is working correctly.
```

---

## Troubleshooting

### "Module not found: pg"

**Solution:**
```bash
cd tests
npm install pg
```

### "password authentication failed"

**Already running API successfully?**

If the `api-v2` application connects successfully to the database, the credentials in `api-v2/.env` are correct:

```env
DATABASE_URL=postgresql://rgpapp:r9pAdmin7@localhost:5432/rgpdb
```

Copy these exact credentials to `tests/test-config.js`:

```javascript
connectionString: 'postgresql://rgpapp:r9pAdmin7@localhost:5432/rgpdb',
```

If the test still fails but the API works, the issue is likely in `pg_hba.conf`. Check that password authentication is allowed for localhost connections.

### "database 'rgpdb' does not exist"

**Solution:**

Create the database:
```sql
CREATE DATABASE rgpdb;
CREATE USER rgpapp WITH PASSWORD 'r9pAdmin7';
GRANT ALL PRIVILEGES ON DATABASE rgpdb TO rgpapp;
```

Then apply the schema from `sql/ddl/` files.

### "Cannot find module './test-config'"

**Solution:**

Ensure `test-config.js` exists in the `tests/` directory. If not, create it using the template in this guide (Step 1).

---

## What the Tests Verify

### Phase 2 Tests (Bill Number Concurrency)
- ✅ No duplicate bill numbers under high concurrency
- ✅ Sequential bill number assignment
- ✅ SELECT FOR UPDATE locking works correctly
- ✅ Performance under load

### Phase 3 Tests (Transaction Rollback)
- ✅ Failed sales creation rolls back completely
- ✅ No orphaned sale headers when items fail
- ✅ Bill numbers not consumed on rollback
- ✅ Purchase invoice deletion is atomic
- ✅ No orphaned invoice items
- ✅ Database integrity maintained

---

## Manual Testing

If automated tests cannot run due to connection issues, you can perform manual verification:

### Manual Test 1: Verify Transaction Wrapper Exists

Check `api-v2/src/modules/app/sales/sale.service.ts` around line 20:

```typescript
async create(sale:any,userid:any) {
    return await this.saleRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        // Transaction code here
    });
}
```

✅ If this transaction wrapper exists, Phase 3 is implemented correctly.

### Manual Test 2: Verify SELECT FOR UPDATE

Check `sql/ddl/functions.sql` around line 18:

```sql
SELECT fiscal_year_start, last_bill_no INTO current_fiscal_year_start, current_bill_no
FROM sales_meta
ORDER BY fiscal_year_start DESC
LIMIT 1
FOR UPDATE;  -- This line is critical!
```

✅ If `FOR UPDATE` exists, Phase 2 is implemented correctly.

### Manual Test 3: Integration Testing via API

You can test the transaction rollback behavior through the API:

1. Start the API:
   ```bash
   cd api-v2
   npm run start:dev
   ```

2. Create a sale with an invalid product ID:
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

3. Verify in database:
   ```sql
   -- Should return 0 rows (no orphaned sales)
   SELECT s.* FROM sale s
   LEFT JOIN sale_item si ON si.sale_id = s.id
   WHERE si.id IS NULL AND s.bill_no IS NOT NULL;
   ```

✅ If the query returns 0 rows, transaction rollback is working correctly.

---

## Next Steps

Once tests pass:

1. ✅ Verify all Phase 2 and Phase 3 fixes are working
2. ⬜ Move to Phase 4: Comprehensive Error Handling
3. ⬜ Create pull request to merge fixes into `revamp` branch
4. ⬜ Deploy to staging environment for integration testing
5. ⬜ Monitor production after deployment

---

## Support

If you continue to have issues:

1. Check PostgreSQL logs for authentication errors
2. Verify the `rgpapp` user exists: `\du` in psql
3. Confirm database exists: `\l` in psql
4. Review `pg_hba.conf` for authentication rules
5. Ensure no firewall blocking localhost:5432

For more details, see:
- `tests/README.md` - Test suite documentation
- `tests/PHASE3_TESTING.md` - Phase 3 testing guide
- `IMPROVEMENT_PLAN.md` - Overall improvement plan
