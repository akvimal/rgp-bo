# RGP Back Office - Test Suite

This directory contains tests for verifying fixes and functionality.

## Phase 2: Bill Number Race Condition Test

### Prerequisites

```bash
npm install pg
```

### Running the Concurrency Test

```bash
cd tests
node test-bill-number-concurrency.js
```

### What This Test Does

1. **Simulates Concurrent Transactions**: Creates 100 parallel database transactions
2. **Generates Bill Numbers**: Each transaction calls `generate_bill_number()`
3. **Checks for Duplicates**: Verifies all bill numbers are unique
4. **Validates Sequence**: Ensures bill numbers are sequential without gaps

### Expected Results

**✅ With Fix (SELECT FOR UPDATE):**
```
Total transactions: 100
Unique bill numbers: 100
Duplicates found: 0
✅ SUCCESS: No race condition detected!
```

**❌ Without Fix (Original Code):**
```
Total transactions: 100
Unique bill numbers: 95
Duplicates found: 5
❌ FAILURE: Race condition detected!
```

### Performance Metrics

The test also measures:
- Total execution time
- Average time per transaction
- Wait time due to locking (expected to be minimal)

### Understanding the Results

- **No Duplicates**: The `FOR UPDATE` lock is working correctly
- **Sequential Numbers**: No gaps in the sequence (important for GST compliance)
- **Reasonable Performance**: Locking should add < 10ms per transaction on average

### Troubleshooting

**Database Connection Issues:**
- Verify PostgreSQL is running
- Check credentials in the test file
- Ensure `sales_meta` table exists

**High Wait Times:**
- Normal under high concurrency (100+ simultaneous transactions)
- Real-world usage will be lower
- Each transaction waits for the lock, then processes quickly

## Next Steps

After running this test successfully:
1. Apply the migration: `psql -d rgpdb -f sql/migrations/002_fix_bill_number_race_condition.sql`
2. Re-run the test to verify
3. Monitor production for performance impact
