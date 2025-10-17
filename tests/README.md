# RGP Back Office - Test Suite

This directory contains tests for verifying fixes and functionality across all phases.

---

## Test Files

1. **test-bill-number-concurrency.js** - Phase 2: Bill number race condition
2. **test-transaction-rollback.js** - Phase 3: Transaction atomicity and rollback
3. **PHASE3_TESTING.md** - Detailed Phase 3 testing guide

---

## Quick Start

```bash
# Install dependencies
npm install pg

# Run Phase 2 tests (Bill number concurrency)
node test-bill-number-concurrency.js

# Run Phase 3 tests (Transaction rollback)
node test-transaction-rollback.js
```

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

**Solution:**
```bash
# Verify PostgreSQL is running
# Check credentials in test files match your setup
# Ensure database 'rgpdb' exists
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
