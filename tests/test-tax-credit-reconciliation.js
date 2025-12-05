/**
 * Test Script: Tax Credit Reconciliation
 *
 * Tests GST tax credit tracking and reconciliation:
 * 1. Create invoice with tax
 * 2. Create tax credit record
 * 3. Update filing status through workflow
 * 4. Report and resolve mismatch
 * 5. Query by filing month
 * 6. Query by status
 * 7. Get reconciliation summary
 *
 * Run: node test-tax-credit-reconciliation.js
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER = {
    email: 'admin@rgp.com',
    password: 'admin123'
};

// Test data
let authToken = null;
let testInvoiceIds = [];
let testTaxCreditIds = [];
const testFilingMonth = '2024-12-01';

// Helper function for API calls
async function apiCall(method, endpoint, data = null) {
    try {
        const config = {
            method,
            url: `${API_BASE_URL}${endpoint}`,
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
            data
        };
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status
        };
    }
}

// Test Functions
async function login() {
    console.log('\n=== Authenticating ===');
    const result = await apiCall('POST', '/auth/login', TEST_USER);

    if (result.success) {
        authToken = result.data.access_token;
        console.log('✓ Login successful');
        return true;
    } else {
        console.error('✗ Login failed:', result.error);
        return false;
    }
}

async function createTestInvoices() {
    console.log('\n=== Creating Test Invoices ===');

    const invoices = [
        {
            vendorid: 1,
            invoiceno: `TAX-TEST-${Date.now()}-1`,
            invoicedate: '2024-12-05',
            total: 118000.00,
            taxamount: 18000.00,
            cgstamount: 9000.00,
            sgstamount: 9000.00,
            igstamount: 0
        },
        {
            vendorid: 1,
            invoiceno: `TAX-TEST-${Date.now()}-2`,
            invoicedate: '2024-12-10',
            total: 59000.00,
            taxamount: 9000.00,
            cgstamount: 0,
            sgstamount: 0,
            igstamount: 9000.00 // Interstate transaction
        }
    ];

    let successCount = 0;

    for (const [index, invoiceData] of invoices.entries()) {
        const result = await apiCall('POST', '/purchases', invoiceData);

        if (result.success) {
            testInvoiceIds.push(result.data.id);
            console.log(`✓ Invoice ${index + 1} created successfully`);
            console.log(`  ID: ${result.data.id}`);
            console.log(`  Invoice No: ${result.data.invoiceno}`);
            console.log(`  Tax Amount: ₹${result.data.taxamount}`);
            successCount++;
        } else {
            console.error(`✗ Invoice ${index + 1} creation failed:`, result.error);
        }
    }

    return successCount === invoices.length;
}

async function createTaxCreditRecords() {
    console.log('\n=== Creating Tax Credit Records ===');

    const taxCredits = [
        {
            invoiceid: testInvoiceIds[0],
            gstfilingmonth: testFilingMonth,
            vendorgstin: '27AAAAA0000A1Z5',
            taxableamount: 100000.00,
            cgstamount: 9000.00,
            sgstamount: 9000.00,
            igstamount: 0,
            totaltaxcredit: 18000.00,
            filingstatus: 'PENDING',
            notes: 'CGST+SGST transaction'
        },
        {
            invoiceid: testInvoiceIds[1],
            gstfilingmonth: testFilingMonth,
            vendorgstin: '29BBBBB0000B1Z6',
            taxableamount: 50000.00,
            cgstamount: 0,
            sgstamount: 0,
            igstamount: 9000.00,
            totaltaxcredit: 9000.00,
            filingstatus: 'PENDING',
            notes: 'IGST interstate transaction'
        }
    ];

    let successCount = 0;

    for (const [index, taxCreditData] of taxCredits.entries()) {
        const result = await apiCall('POST', '/purchases/tax-credits', taxCreditData);

        if (result.success) {
            testTaxCreditIds.push(result.data.id);
            console.log(`✓ Tax credit ${index + 1} created successfully`);
            console.log(`  ID: ${result.data.id}`);
            console.log(`  Invoice ID: ${result.data.invoiceid}`);
            console.log(`  GSTIN: ${result.data.vendorgstin}`);
            console.log(`  Tax Credit: ₹${result.data.totaltaxcredit}`);
            console.log(`  Filing Status: ${result.data.filingstatus}`);
            successCount++;
        } else {
            console.error(`✗ Tax credit ${index + 1} creation failed:`, result.error);
        }
    }

    return successCount === taxCredits.length;
}

async function updateFilingStatusWorkflow() {
    console.log('\n=== Testing Filing Status Workflow ===');

    if (testTaxCreditIds.length === 0) {
        console.error('✗ No tax credits to update');
        return false;
    }

    const taxCreditId = testTaxCreditIds[0];
    const statuses = [
        {
            filingstatus: 'FILED_BY_VENDOR',
            fileddate: '2024-12-11',
            notes: 'Vendor filed GSTR-1'
        },
        {
            filingstatus: 'REFLECTED_IN_2A',
            reflectedin2adate: '2024-12-13',
            notes: 'Reflected in our GSTR-2A'
        },
        {
            filingstatus: 'CLAIMED',
            claimedinreturn: 'GSTR-3B Dec 2024',
            claimeddate: '2024-12-20',
            notes: 'Claimed in GSTR-3B return'
        }
    ];

    for (const [index, statusUpdate] of statuses.entries()) {
        console.log(`\nStep ${index + 1}: Updating to ${statusUpdate.filingstatus}`);

        const result = await apiCall('PUT', `/purchases/tax-credits/${taxCreditId}/filing-status`, statusUpdate);

        if (result.success) {
            console.log(`✓ Status updated to ${statusUpdate.filingstatus}`);
        } else {
            console.error(`✗ Status update failed:`, result.error);
            return false;
        }
    }

    // Verify final status
    const verifyResult = await apiCall('GET', `/purchases/tax-credits/invoice/${testInvoiceIds[0]}`);
    if (verifyResult.success) {
        console.log('\n✓ Final verification:');
        console.log(`  Filing Status: ${verifyResult.data.filingstatus}`);
        console.log(`  Filed Date: ${verifyResult.data.fileddate}`);
        console.log(`  Reflected Date: ${verifyResult.data.reflectedin2adate}`);
        console.log(`  Claimed Date: ${verifyResult.data.claimeddate}`);
        return true;
    }

    return false;
}

async function reportMismatch() {
    console.log('\n=== Reporting Tax Mismatch ===');

    if (testTaxCreditIds.length < 2) {
        console.error('✗ Not enough tax credits');
        return false;
    }

    const taxCreditId = testTaxCreditIds[1];
    const mismatchData = {
        hasmismatch: true,
        mismatchreason: 'Amount difference in GSTR-2A - Vendor filed ₹8,500 instead of ₹9,000',
        mismatchamount: 500.00,
        mismatchresolved: false,
        mismatchresolutionnotes: 'Contacted vendor for correction'
    };

    const result = await apiCall('PUT', `/purchases/tax-credits/${taxCreditId}/mismatch`, mismatchData);

    if (result.success) {
        console.log('✓ Mismatch reported successfully');
        console.log(`  Tax Credit ID: ${taxCreditId}`);
        console.log(`  Mismatch Amount: ₹${mismatchData.mismatchamount}`);
        console.log(`  Reason: ${mismatchData.mismatchreason}`);
        return true;
    } else {
        console.error('✗ Mismatch reporting failed:', result.error);
        return false;
    }
}

async function resolveMismatch() {
    console.log('\n=== Resolving Tax Mismatch ===');

    if (testTaxCreditIds.length < 2) {
        console.error('✗ Not enough tax credits');
        return false;
    }

    const taxCreditId = testTaxCreditIds[1];
    const resolveData = {
        hasmismatch: true,
        mismatchreason: 'Amount difference in GSTR-2A - Vendor filed ₹8,500 instead of ₹9,000',
        mismatchamount: 500.00,
        mismatchresolved: true,
        mismatchresolutionnotes: 'Vendor filed amendment. Corrected amount reflected in GSTR-2A.'
    };

    const result = await apiCall('PUT', `/purchases/tax-credits/${taxCreditId}/mismatch`, resolveData);

    if (result.success) {
        console.log('✓ Mismatch resolved successfully');
        console.log(`  Resolution: ${resolveData.mismatchresolutionnotes}`);
        return true;
    } else {
        console.error('✗ Mismatch resolution failed:', result.error);
        return false;
    }
}

async function queryByFilingMonth() {
    console.log('\n=== Querying by Filing Month ===');

    const result = await apiCall('GET', `/purchases/tax-credits/filing-month/${testFilingMonth}`);

    if (result.success) {
        console.log(`✓ Retrieved tax credits for ${testFilingMonth}`);
        console.log(`  Count: ${result.data.length}`);

        result.data.forEach((tc, index) => {
            console.log(`\n  Tax Credit ${index + 1}:`);
            console.log(`    ID: ${tc.id}`);
            console.log(`    Invoice ID: ${tc.invoiceid}`);
            console.log(`    GSTIN: ${tc.vendorgstin}`);
            console.log(`    Tax Credit: ₹${tc.totaltaxcredit}`);
            console.log(`    Status: ${tc.filingstatus}`);
            console.log(`    Has Mismatch: ${tc.hasmismatch}`);
        });

        return true;
    } else {
        console.error('✗ Query by filing month failed:', result.error);
        return false;
    }
}

async function queryByStatus() {
    console.log('\n=== Querying by Filing Status ===');

    const statuses = ['PENDING', 'FILED_BY_VENDOR', 'REFLECTED_IN_2A', 'CLAIMED'];

    for (const status of statuses) {
        const result = await apiCall('GET', `/purchases/tax-credits/status/${status}`);

        if (result.success) {
            console.log(`\n  ${status}: ${result.data.length} record(s)`);
        } else {
            console.error(`  ✗ Query for ${status} failed`);
        }
    }

    return true;
}

async function queryUnresolvedMismatches() {
    console.log('\n=== Querying Unresolved Mismatches ===');

    const result = await apiCall('GET', '/purchases/tax-credits/mismatches');

    if (result.success) {
        console.log(`✓ Retrieved unresolved mismatches`);
        console.log(`  Count: ${result.data.length}`);

        result.data.forEach((tc, index) => {
            console.log(`\n  Mismatch ${index + 1}:`);
            console.log(`    Tax Credit ID: ${tc.id}`);
            console.log(`    Invoice ID: ${tc.invoiceid}`);
            console.log(`    GSTIN: ${tc.vendorgstin}`);
            console.log(`    Mismatch Amount: ₹${tc.mismatchamount}`);
            console.log(`    Reason: ${tc.mismatchreason}`);
            console.log(`    Resolved: ${tc.mismatchresolved}`);
        });

        return true;
    } else {
        console.error('✗ Query for mismatches failed:', result.error);
        return false;
    }
}

async function getReconciliationSummary() {
    console.log('\n=== Getting Reconciliation Summary ===');

    const result = await apiCall('GET', `/purchases/tax-credits/reconciliation-summary/${testFilingMonth}`);

    if (result.success) {
        const summary = result.data;
        console.log('✓ Reconciliation summary retrieved');

        console.log('\n  Filing Period Summary:');
        console.log(`    Filing Month: ${summary.filingMonth}`);
        console.log(`    Total Invoices: ${summary.totalInvoices}`);
        console.log(`    Total Tax Credit: ₹${summary.totalTaxCredit}`);
        console.log(`    Total CGST: ₹${summary.totalCGST}`);
        console.log(`    Total SGST: ₹${summary.totalSGST}`);
        console.log(`    Total IGST: ₹${summary.totalIGST}`);

        console.log('\n  By Filing Status:');
        Object.entries(summary.byStatus).forEach(([status, count]) => {
            if (count > 0) {
                console.log(`    ${status}: ${count}`);
            }
        });

        console.log('\n  Mismatch Summary:');
        console.log(`    Total Mismatches: ${summary.mismatches.count}`);
        console.log(`    Total Mismatch Amount: ₹${summary.mismatches.totalAmount}`);
        console.log(`    Resolved: ${summary.mismatches.resolved}`);
        console.log(`    Pending: ${summary.mismatches.pending}`);

        return true;
    } else {
        console.error('✗ Failed to get reconciliation summary:', result.error);
        return false;
    }
}

async function testValidation() {
    console.log('\n=== Testing Validation Rules ===');

    // Test 1: Try to create tax credit with mismatched amounts
    console.log('\nTest 1: Tax credit with mismatched amounts');
    const invalidTaxCredit = {
        invoiceid: testInvoiceIds[0],
        gstfilingmonth: testFilingMonth,
        vendorgstin: '27CCCCC0000C1Z7',
        taxableamount: 100000.00,
        cgstamount: 5000.00,
        sgstamount: 5000.00,
        igstamount: 0,
        totaltaxcredit: 12000.00 // Should be 10000 (5000+5000)
    };

    const result1 = await apiCall('POST', '/purchases/tax-credits', invalidTaxCredit);
    if (!result1.success && result1.status === 400) {
        console.log('✓ Correctly rejected tax credit with mismatched amounts');
    } else {
        console.log('✗ Should have rejected invalid tax credit');
    }

    // Test 2: Try to create duplicate tax credit for same invoice
    console.log('\nTest 2: Duplicate tax credit for same invoice');
    const duplicateTaxCredit = {
        invoiceid: testInvoiceIds[0],
        gstfilingmonth: testFilingMonth,
        vendorgstin: '27AAAAA0000A1Z5',
        taxableamount: 100000.00,
        cgstamount: 9000.00,
        sgstamount: 9000.00,
        totaltaxcredit: 18000.00
    };

    const result2 = await apiCall('POST', '/purchases/tax-credits', duplicateTaxCredit);
    if (!result2.success && result2.status === 400) {
        console.log('✓ Correctly rejected duplicate tax credit');
    } else {
        console.log('✗ Should have rejected duplicate tax credit');
    }

    // Test 3: Invalid GSTIN length
    console.log('\nTest 3: Invalid GSTIN length');
    const invalidGSTIN = {
        invoiceid: testInvoiceIds[1],
        gstfilingmonth: testFilingMonth,
        vendorgstin: '12345', // Should be 15 characters
        taxableamount: 50000.00,
        totaltaxcredit: 9000.00
    };

    const result3 = await apiCall('POST', '/purchases/tax-credits', invalidGSTIN);
    if (!result3.success && result3.status === 400) {
        console.log('✓ Correctly rejected invalid GSTIN');
    } else {
        console.log('✗ Should have rejected invalid GSTIN');
    }
}

async function testInvoiceTaxStatusSync() {
    console.log('\n=== Testing Invoice Tax Status Synchronization ===');

    // Check if invoice tax status was updated when tax credit reached CLAIMED
    const result = await apiCall('GET', `/purchases/${testInvoiceIds[0]}`);

    if (result.success) {
        console.log('✓ Invoice retrieved');
        console.log(`  Tax Status: ${result.data.taxstatus}`);
        console.log(`  Total Tax Credit: ₹${result.data.totaltaxcredit || 0}`);

        if (result.data.taxstatus === 'RECONCILED') {
            console.log('✓ Invoice tax status correctly updated to RECONCILED');
            return true;
        } else {
            console.log(`✗ Expected RECONCILED but got ${result.data.taxstatus}`);
            return false;
        }
    } else {
        console.error('✗ Failed to retrieve invoice:', result.error);
        return false;
    }
}

async function cleanup() {
    console.log('\n=== Cleanup ===');
    console.log('Note: Test data left in database for verification');
    console.log(`Invoice IDs: ${testInvoiceIds.join(', ')}`);
    console.log(`Tax Credit IDs: ${testTaxCreditIds.join(', ')}`);
}

// Main test execution
async function runTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║      Tax Credit Reconciliation Test Suite             ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const startTime = Date.now();
    let passedTests = 0;
    let totalTests = 0;

    try {
        // Test 1: Authentication
        totalTests++;
        if (await login()) passedTests++;
        else return;

        // Test 2: Create Test Invoices
        totalTests++;
        if (await createTestInvoices()) passedTests++;
        else return;

        // Test 3: Create Tax Credit Records
        totalTests++;
        if (await createTaxCreditRecords()) passedTests++;

        // Test 4: Filing Status Workflow
        totalTests++;
        if (await updateFilingStatusWorkflow()) passedTests++;

        // Test 5: Report Mismatch
        totalTests++;
        if (await reportMismatch()) passedTests++;

        // Test 6: Resolve Mismatch
        totalTests++;
        if (await resolveMismatch()) passedTests++;

        // Test 7: Query by Filing Month
        totalTests++;
        if (await queryByFilingMonth()) passedTests++;

        // Test 8: Query by Status
        totalTests++;
        if (await queryByStatus()) passedTests++;

        // Test 9: Query Unresolved Mismatches
        totalTests++;
        if (await queryUnresolvedMismatches()) passedTests++;

        // Test 10: Reconciliation Summary
        totalTests++;
        if (await getReconciliationSummary()) passedTests++;

        // Test 11: Validation Rules
        totalTests++;
        if (await testValidation()) passedTests++;

        // Test 12: Invoice Tax Status Sync
        totalTests++;
        if (await testInvoiceTaxStatusSync()) passedTests++;

        // Cleanup
        await cleanup();

    } catch (error) {
        console.error('\n✗ Unexpected error:', error.message);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    Test Summary                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\nTests Passed: ${passedTests}/${totalTests}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);

    if (passedTests === totalTests) {
        console.log('\n✓ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n✗ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runTests();
