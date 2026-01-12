# RGP Back Office - Test Suite

This directory contains tests for verifying fixes and functionality across all phases.

---

## Test Files

### Phase 2 & 3: Core Transaction Testing
1. **test-bill-number-concurrency.js** - Phase 2: Bill number race condition
2. **test-transaction-rollback.js** - Phase 3: Transaction atomicity and rollback
3. **PHASE3_TESTING.md** - Phase 3 transaction rollback testing guide

### Enhanced Invoice Lifecycle Testing
4. **test-invoice-lifecycle.js** - Invoice lifecycle management
5. **test-payment-management.js** - Payment tracking and status
6. **test-tax-credit-reconciliation.js** - GST tax credit workflow
7. **test-complete-invoice-workflow.js** - End-to-end workflow integration
8. **ENHANCED_INVOICE_LIFECYCLE_TESTING.md** - Comprehensive testing guide

### HSN & Tax System Testing
9. **test-hsn-tax-lookup.js** - HSN code and tax rate lookup
10. **test-tax-auto-population.js** - Automatic tax population
11. **test-phase2-pricing-system.js** - Advanced pricing rules engine

### Utility & Diagnostics
12. **test-connection.js** - Database connectivity verification
13. **test-auth-debug.js** - Authentication debugging
14. **diagnose-auth.js** - Authentication diagnostics
15. **verify-via-api.js** - API-based verification

---

## Quick Start

```bash
# Install dependencies
npm install pg

# Configure database credentials (if needed)
# Edit tests/test-config.js with your database credentials

# Run Phase 2 tests (Bill number concurrency)
node test-bill-number-concurrency.js

# Run Phase 3 tests (Transaction rollback)
node test-transaction-rollback.js
```

### Database Configuration

All tests use `test-config.js` for database credentials. If you encounter connection errors:

1. **Update credentials in test-config.js**:
   ```javascript
   connectionString: 'postgresql://username:password@localhost:5432/database'
   ```

2. **Or use environment variables**:
   ```bash
   set DATABASE_URL=postgresql://username:password@localhost:5432/database
   node test-transaction-rollback.js
   ```

3. **Default credentials** (from api-v2/.env):
   - User: `rgpapp`
   - Password: `r9pAdmin7`
   - Database: `rgpdb`
   - Host: `localhost:5432`

---

## Phase 2: Bill Number Race Condition Test

### Running the Test

```bash
node test-bill-number-concurrency.js
```

### What It Tests

1. **Concurrent Bill Generation**: 100 parallel transactions
2. **Uniqueness**: No duplicate bill numbers
3. **Sequential Order**: No gaps in sequence
4. **Performance**: Lock wait times

### Expected Output

**✅ Success:**
```
Total transactions: 100
Unique bill numbers: 100
Duplicates found: 0
✅ SUCCESS: No race condition detected!
```

**❌ Failure:**
```
Total transactions: 100
Unique bill numbers: 95
Duplicates found: 5
❌ FAILURE: Race condition detected!
```

---

## Phase 3: Transaction Rollback Tests

### Running the Tests

```bash
node test-transaction-rollback.js
```

### What It Tests

1. **Sale Creation Rollback**: Verifies no orphaned sales when item save fails
2. **Purchase Deletion Rollback**: Verifies atomic cascade deletes
3. **Orphaned Item Detection**: Scans for orphaned sale/invoice items
4. **Bill Number Integrity**: Checks for duplicates
5. **Transaction Isolation**: Verifies SERIALIZABLE behavior

### Expected Output

```
✅ PASS: Sale Creation Rollback
✅ PASS: Purchase Invoice Deletion Rollback
✅ PASS: No Orphaned Sale Items
✅ PASS: No Orphaned Invoice Items
✅ PASS: Bill Number Sequence Integrity

Total Tests: 5
Passed: 5 ✅
Failed: 0 ❌
```

### Manual Testing

See [PHASE3_TESTING.md](./PHASE3_TESTING.md) for:
- Manual test scenarios
- Database integrity checks
- Performance testing
- Troubleshooting guide

---

## Common Issues

### Database Connection Errors

**Problem:** Tests can't connect to database

**Error:** `password authentication failed for user "rgpapp"`

**Solutions:**

1. **Update test-config.js** with your actual database credentials
   ```javascript
   connectionString: 'postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/rgpdb'
   ```

2. **Check PostgreSQL is running**:
   ```bash
   # Windows
   netstat -an | findstr ":5432"

   # Should show LISTENING on port 5432
   ```

3. **Verify credentials work** by checking if API can connect:
   ```bash
   cd api-v2
   npm run start:dev
   # If API starts successfully, database credentials are correct
   ```

4. **Check pg_hba.conf** authentication method:
   - Ensure PostgreSQL allows password (md5 or scram-sha-256) authentication
   - Location: `PostgreSQL/data/pg_hba.conf`
   - Look for line: `host all all 127.0.0.1/32 md5`

5. **Verify database exists**:
   ```bash
   # If you have psql in PATH:
   psql -U rgpapp -d rgpdb -c "SELECT 1"
   ```

### High Wait Times (Phase 2)

**Problem:** Transactions taking > 100ms

**Cause:** Normal under high concurrency (100+ simultaneous)

**Solution:** Real-world usage has lower concurrency, this is expected

### Orphaned Data Found (Phase 3)

**Problem:** Tests find orphaned sale/invoice items

**Cause:** Transaction rollback not working

**Solution:**
1. Verify NestJS and TypeORM versions
2. Check database supports transactions
3. Review error logs for transaction failures
4. Apply Phase 3 fixes if not already applied

---

## Success Criteria

### Phase 2
- ✅ Zero duplicate bill numbers under load
- ✅ Sequential bill numbers (no gaps)
- ✅ Performance < 100ms per transaction

### Phase 3
- ✅ No orphaned sale items
- ✅ No orphaned invoice items
- ✅ Rollback prevents partial commits
- ✅ Bill numbers only consumed on success
- ✅ Performance < 500ms per transaction

---

## Next Steps

1. ✅ Run Phase 2 tests
2. ✅ Run Phase 3 tests
3. ⬜ Review PHASE3_TESTING.md for manual tests
4. ⬜ Run performance tests under load
5. ⬜ Monitor production after deployment
