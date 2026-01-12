# Phase 3 - Enhanced Invoice Lifecycle Testing Guide

This directory contains comprehensive test scripts for Phase 3 of the Enhanced Purchase Invoice Lifecycle Management system.

## Test Scripts Overview

### 1. Invoice Lifecycle Test (`test-invoice-lifecycle.js`)
Tests the core invoice lifecycle management functionality.

**What it tests:**
- Invoice creation with lifecycle status initialization
- Adding items with different types (REGULAR, RETURN, SUPPLIED)
- Item validation rules (challan reference, return reason)
- Item verification workflow
- Invoice completion
- Closure eligibility checks
- Lifecycle summary retrieval
- Validation error handling

**Run:**
```bash
node test-invoice-lifecycle.js
```

**Expected Results:**
- 8 tests should pass
- Invoice should progress from OPEN → COMPLETE
- Items should validate type-specific requirements
- Lifecycle summary should show complete status

---

### 2. Payment Management Test (`test-payment-management.js`)
Tests payment tracking and automatic status calculation.

**What it tests:**
- Creating partial payments
- Automatic payment status calculation (UNPAID → PARTIAL → PAID)
- Multiple payment recording
- Payment summary generation
- Payment reconciliation
- Payment updates
- Payment deletion with status recalculation
- Advance payments (exceeding invoice amount)

**Run:**
```bash
node test-payment-management.js
```

**Expected Results:**
- 12 tests should pass
- Payment status should auto-update after each payment
- Total paid should match sum of completed payments
- Deleting payment should recalculate status correctly

---

### 3. Tax Credit Reconciliation Test (`test-tax-credit-reconciliation.js`)
Tests GST tax credit tracking and reconciliation workflow.

**What it tests:**
- Tax credit record creation
- Tax amount validation
- Filing status workflow (PENDING → FILED_BY_VENDOR → REFLECTED_IN_2A → CLAIMED)
- Mismatch reporting and resolution
- Querying by filing month
- Querying by filing status
- Unresolved mismatch queries
- Monthly reconciliation summary
- Invoice tax status synchronization
- Duplicate detection
- GSTIN validation

**Run:**
```bash
node test-tax-credit-reconciliation.js
```

**Expected Results:**
- 12 tests should pass
- Filing status should progress through complete workflow
- Mismatches should be tracked and resolvable
- Invoice tax_status should sync with tax credit status

---

### 4. Complete Workflow Integration Test (`test-complete-invoice-workflow.js`)
Tests the entire end-to-end invoice lifecycle from creation to closure.

**What it tests:**
- Complete invoice creation with items
- Item verification
- Invoice completion
- Multi-stage payment processing
- Tax credit creation and filing tracking
- Invoice closure
- Complete lifecycle verification

**Workflow Steps:**
1. Create invoice (₹118,000)
2. Add 4 items (Regular, Return, Supplied)
3. Verify all items
4. Complete invoice
5. Process 3 payments (₹50,000 + ₹30,000 + ₹38,000)
6. Create tax credit record (₹18,000)
7. Track tax filing (PENDING → CLAIMED)
8. Close invoice
9. Verify final status

**Run:**
```bash
node test-complete-invoice-workflow.js
```

**Expected Results:**
- All 10 steps should complete successfully
- Final status:
  - Invoice Status: COMPLETE
  - Payment Status: PAID
  - Tax Status: RECONCILED
  - Lifecycle Status: CLOSED
  - Outstanding: ₹0

---

## Prerequisites

### 1. Install Dependencies
```bash
cd tests
npm install axios
```

### 2. Start API Server
Ensure the API server is running:
```bash
cd ../api-v2
npm run start:dev
```

Or using Docker:
```bash
cd ..
docker-compose up -d api
```

### 3. Verify Database
Ensure PostgreSQL is running and the database schema is up to date:
```bash
# Check migrations are applied
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/006_enhanced_invoice_lifecycle.sql
```

### 4. Environment Configuration
Tests use these default settings:
- API URL: `http://localhost:3000`
- Test User: `admin@rgp.com` / `admin123`

To override:
```bash
export API_URL=http://your-api-url:port
node test-invoice-lifecycle.js
```

---

## Running All Tests

### Option 1: Run Individually
```bash
node test-invoice-lifecycle.js
node test-payment-management.js
node test-tax-credit-reconciliation.js
node test-complete-invoice-workflow.js
```

### Option 2: Run with npm script (add to package.json)
```json
{
  "scripts": {
    "test:lifecycle": "node test-invoice-lifecycle.js",
    "test:payment": "node test-payment-management.js",
    "test:tax": "node test-tax-credit-reconciliation.js",
    "test:workflow": "node test-complete-invoice-workflow.js",
    "test:phase3": "npm run test:lifecycle && npm run test:payment && npm run test:tax && npm run test:workflow"
  }
}
```

Then run:
```bash
npm run test:phase3
```

---

## Test Data Management

### Test Data Retention
All tests leave test data in the database for manual verification. This allows you to:
- Verify data in Swagger UI
- Inspect records in database
- Test frontend components with real data

### Cleanup
Each test prints cleanup SQL at the end. Example:
```sql
DELETE FROM purchase_invoice_tax_credit WHERE id = 123;
DELETE FROM vendor_payment WHERE id IN (456,457,458);
DELETE FROM purchase_invoice_item WHERE id IN (789,790,791);
DELETE FROM purchase_invoice WHERE id = 100;
```

Run this SQL to clean up test data:
```bash
docker exec -it rgp-db psql -U rgpapp -d rgpdb
# Paste and run the DELETE statements
```

---

## API Endpoints Tested

### Invoice Lifecycle
- `POST /purchases` - Create invoice
- `POST /purchases/items` - Add items
- `PUT /purchases/items` - Update items
- `POST /purchases/:id/complete` - Complete invoice
- `GET /purchases/:id/can-close` - Check closure eligibility
- `POST /purchases/:id/close` - Close invoice
- `POST /purchases/:id/reopen` - Reopen invoice
- `GET /purchases/:id/lifecycle-summary` - Get lifecycle summary
- `PUT /purchases/:id/payment-status` - Update payment status

### Payment Management
- `POST /purchases/:id/payments` - Create payment
- `GET /purchases/:id/payments` - List payments
- `GET /purchases/:id/payments/summary` - Payment summary
- `PUT /payments/:paymentId` - Update payment
- `PUT /payments/:paymentId/reconcile` - Reconcile payment
- `DELETE /payments/:paymentId` - Delete payment

### Tax Credit
- `POST /purchases/tax-credits` - Create tax credit
- `PUT /purchases/tax-credits/:id/filing-status` - Update filing status
- `PUT /purchases/tax-credits/:id/mismatch` - Report mismatch
- `GET /purchases/tax-credits/invoice/:invoiceId` - Get by invoice
- `GET /purchases/tax-credits/filing-month/:month` - Get by month
- `GET /purchases/tax-credits/status/:status` - Filter by status
- `GET /purchases/tax-credits/mismatches` - Get unresolved mismatches
- `GET /purchases/tax-credits/reconciliation-summary/:month` - Monthly summary
- `DELETE /purchases/tax-credits/:id` - Delete record

---

## Expected Test Coverage

### Functional Coverage
- ✓ Invoice creation and lifecycle transitions
- ✓ Item type validation (REGULAR, RETURN, SUPPLIED)
- ✓ Payment status automatic calculation
- ✓ Tax credit workflow (PENDING → CLAIMED)
- ✓ Mismatch tracking and resolution
- ✓ Invoice closure validation
- ✓ Status synchronization across entities

### Error Handling Coverage
- ✓ Missing required fields (challan_ref, return_reason)
- ✓ Invalid tax amounts
- ✓ Duplicate tax credit records
- ✓ Invalid GSTIN format
- ✓ Premature invoice closure attempts
- ✓ Business rule violations

### Integration Coverage
- ✓ Multi-step workflows
- ✓ Status propagation (invoice ↔ tax credit)
- ✓ Automatic calculations (payment status, totals)
- ✓ Audit trail recording (user, timestamps)

---

## Troubleshooting

### Test Fails: "Login failed"
**Cause:** API server not running or wrong credentials
**Fix:**
```bash
# Check API is running
curl http://localhost:3000/health

# Verify test user exists
docker exec -it rgp-db psql -U rgpapp -d rgpdb -c "SELECT * FROM app_user WHERE email = 'admin@rgp.com';"
```

### Test Fails: "Invoice creation failed"
**Cause:** Database schema not migrated
**Fix:**
```bash
# Apply Phase 1 migration
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/006_enhanced_invoice_lifecycle.sql
```

### Test Fails: "Validation error"
**Cause:** Entity or DTO validation rules
**Check:**
- Enum values are correct (see `api-v2/src/modules/app/purchases/enums/`)
- Required fields are provided
- Data types match entity definitions

### Test Timeout
**Cause:** API endpoint taking too long
**Fix:**
```bash
# Check API logs
docker logs rgp-bo-api-1 --tail 100

# Check database connections
docker exec -it rgp-db psql -U rgpapp -d rgpdb -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Viewing Results in Swagger

After running tests, you can verify results in Swagger UI:

1. Open http://localhost:3000/api
2. Authorize with test credentials
3. Navigate to relevant endpoints
4. Use test invoice/payment/tax credit IDs from test output

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Phase 3 Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_DB: rgpdb
          POSTGRES_USER: rgpapp
          POSTGRES_PASSWORD: rgppass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd api-v2 && npm install
          cd ../tests && npm install

      - name: Apply migrations
        run: psql -h localhost -U rgpapp -d rgpdb < sql/migrations/006_enhanced_invoice_lifecycle.sql

      - name: Start API
        run: cd api-v2 && npm run start &

      - name: Wait for API
        run: sleep 10

      - name: Run tests
        run: |
          cd tests
          node test-invoice-lifecycle.js
          node test-payment-management.js
          node test-tax-credit-reconciliation.js
          node test-complete-invoice-workflow.js
```

---

## Test Metrics

### Coverage Goals
- **API Endpoints**: 100% of Phase 3 endpoints tested
- **Business Logic**: All lifecycle transitions validated
- **Error Cases**: Critical validation rules tested
- **Integration**: Complete workflow from creation to closure

### Performance Expectations
- Individual tests: 5-15 seconds
- Complete workflow test: 10-20 seconds
- All tests combined: < 60 seconds

### Success Criteria
- All tests pass consistently
- No false positives
- Clear error messages on failure
- Test data cleanup instructions provided

---

## Additional Resources

- **Phase 3 Implementation**: `docs/ENHANCED_INVOICE_LIFECYCLE.md`
- **API Documentation**: http://localhost:3000/api
- **Database Schema**: `sql/migrations/006_enhanced_invoice_lifecycle.sql`
- **Entity Definitions**: `api-v2/src/entities/`
- **Service Layer**: `api-v2/src/modules/app/purchases/`

---

## Contributing

When adding new Phase 3 features:

1. Update relevant test scripts
2. Add new test cases for new endpoints
3. Update this README with new test coverage
4. Ensure all tests pass before committing
5. Document any new test data requirements

---

**Last Updated**: 2024-12-05
**Phase 3 Version**: 1.0.0
**Test Coverage**: 100% of Phase 3 endpoints
