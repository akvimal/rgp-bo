/**
 * Test Script: Invoice Lifecycle Management
 *
 * Tests the complete invoice lifecycle workflow:
 * 1. Create invoice (OPEN status)
 * 2. Add items (REGULAR, RETURN, SUPPLIED types)
 * 3. Verify items
 * 4. Complete invoice
 * 5. Check closure eligibility
 * 6. Get lifecycle summary
 *
 * Run: node test-invoice-lifecycle.js
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
let testInvoiceId = null;
let testItemIds = [];

// Helper function for API calls
async function apiCall(method, endpoint, data = null, params = null) {
    try {
        const config = {
            method,
            url: `${API_BASE_URL}${endpoint}`,
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
            data,
            params
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

async function createInvoice() {
    console.log('\n=== Creating Invoice ===');

    const invoiceData = {
        vendorid: 1,
        invoiceno: `TEST-INV-${Date.now()}`,
        invoicedate: new Date().toISOString().split('T')[0],
        duedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total: 50000.00,
        discpcnt: 5,
        discamount: 2500.00,
        taxpcnt: 18,
        taxamount: 8550.00,
        doctype: 'INVOICE',
        cgstamount: 4275.00,
        sgstamount: 4275.00,
        igstamount: 0
    };

    const result = await apiCall('POST', '/purchases', invoiceData);

    if (result.success) {
        testInvoiceId = result.data.id;
        console.log('✓ Invoice created successfully');
        console.log(`  Invoice ID: ${testInvoiceId}`);
        console.log(`  Invoice No: ${result.data.invoiceno}`);
        console.log(`  Payment Status: ${result.data.paymentstatus}`);
        console.log(`  Tax Status: ${result.data.taxstatus}`);
        console.log(`  Lifecycle Status: ${result.data.lifecyclestatus}`);
        return true;
    } else {
        console.error('✗ Invoice creation failed:', result.error);
        return false;
    }
}

async function addInvoiceItems() {
    console.log('\n=== Adding Invoice Items ===');

    const items = [
        {
            invoiceid: testInvoiceId,
            productid: 1,
            itemtype: 'REGULAR',
            batch: `BATCH-${Date.now()}-1`,
            expdate: '2025-12-31',
            ptrvalue: 100.00,
            ptrcost: 10000.00,
            mrpcost: 120.00,
            discpcnt: 5,
            taxpcnt: 18,
            cgstpcnt: 9,
            sgstpcnt: 9,
            igstpcnt: 0,
            cgstamount: 855.00,
            sgstamount: 855.00,
            igstamount: 0,
            qty: 100,
            freeqty: 10,
            total: 18810.00
        },
        {
            invoiceid: testInvoiceId,
            productid: 2,
            itemtype: 'RETURN',
            batch: `RETURN-${Date.now()}`,
            returnreason: 'Damaged packaging',
            ptrvalue: 50.00,
            ptrcost: 2500.00,
            mrpcost: 60.00,
            qty: 50,
            total: -2500.00 // Negative for return
        },
        {
            invoiceid: testInvoiceId,
            productid: 3,
            itemtype: 'SUPPLIED',
            batch: `BATCH-${Date.now()}-2`,
            challanref: `DC-${Date.now()}`,
            ptrvalue: 200.00,
            ptrcost: 20000.00,
            mrpcost: 240.00,
            taxpcnt: 18,
            cgstpcnt: 9,
            sgstpcnt: 9,
            cgstamount: 1710.00,
            sgstamount: 1710.00,
            qty: 100,
            total: 23420.00
        }
    ];

    let successCount = 0;

    for (const [index, itemData] of items.entries()) {
        const result = await apiCall('POST', '/purchases/items', itemData);

        if (result.success) {
            testItemIds.push(result.data.id);
            console.log(`✓ Item ${index + 1} added successfully (${itemData.itemtype})`);
            console.log(`  Item ID: ${result.data.id}`);
            console.log(`  Batch: ${result.data.batch}`);
            if (itemData.itemtype === 'RETURN') {
                console.log(`  Return Reason: ${result.data.returnreason}`);
            }
            if (itemData.itemtype === 'SUPPLIED') {
                console.log(`  Challan Ref: ${result.data.challanref}`);
            }
            successCount++;
        } else {
            console.error(`✗ Item ${index + 1} creation failed:`, result.error);
        }
    }

    console.log(`\nAdded ${successCount}/${items.length} items`);
    return successCount === items.length;
}

async function verifyItems() {
    console.log('\n=== Verifying Items ===');

    if (testItemIds.length === 0) {
        console.error('✗ No items to verify');
        return false;
    }

    const result = await apiCall('PUT', '/purchases/items', {
        ids: testItemIds,
        values: { status: 'VERIFIED' }
    });

    if (result.success) {
        console.log('✓ All items verified successfully');
        console.log(`  Verified ${testItemIds.length} items`);
        return true;
    } else {
        console.error('✗ Item verification failed:', result.error);
        return false;
    }
}

async function completeInvoice() {
    console.log('\n=== Completing Invoice ===');

    const result = await apiCall('POST', `/purchases/${testInvoiceId}/complete`, {});

    if (result.success) {
        console.log('✓ Invoice completed successfully');
        console.log('  Status changed to COMPLETE');
        console.log('  Tax totals calculated and recorded');
        return true;
    } else {
        console.error('✗ Invoice completion failed:', result.error);
        return false;
    }
}

async function checkClosureEligibility() {
    console.log('\n=== Checking Closure Eligibility ===');

    const result = await apiCall('GET', `/purchases/${testInvoiceId}/can-close`);

    if (result.success) {
        console.log(`✓ Closure check completed`);
        console.log(`  Can Close: ${result.data.canClose}`);
        if (!result.data.canClose) {
            console.log('  Reasons:');
            result.data.reasons.forEach(reason => {
                console.log(`    - ${reason}`);
            });
        }
        return true;
    } else {
        console.error('✗ Closure check failed:', result.error);
        return false;
    }
}

async function getLifecycleSummary() {
    console.log('\n=== Getting Lifecycle Summary ===');

    const result = await apiCall('GET', `/purchases/${testInvoiceId}/lifecycle-summary`);

    if (result.success) {
        const summary = result.data;
        console.log('✓ Lifecycle summary retrieved');
        console.log('\n  Invoice Status:');
        console.log(`    ID: ${summary.invoice.id}`);
        console.log(`    Invoice No: ${summary.invoice.invoiceNo}`);
        console.log(`    Doc Type: ${summary.invoice.docType}`);
        console.log(`    Status: ${summary.invoice.status}`);
        console.log(`    Payment Status: ${summary.invoice.paymentStatus}`);
        console.log(`    Tax Status: ${summary.invoice.taxStatus}`);
        console.log(`    Lifecycle Status: ${summary.invoice.lifecycleStatus}`);

        console.log('\n  Items:');
        console.log(`    Total: ${summary.items.total}`);
        console.log(`    Regular: ${summary.items.regular}`);
        console.log(`    Return: ${summary.items.return}`);
        console.log(`    Supplied: ${summary.items.supplied}`);
        console.log(`    Verified: ${summary.items.verified}`);
        console.log(`    Pending: ${summary.items.pending}`);

        console.log('\n  Financial:');
        console.log(`    Total: ₹${summary.financial.total}`);
        console.log(`    Paid: ₹${summary.financial.paidAmount}`);
        console.log(`    Outstanding: ₹${summary.financial.outstanding}`);
        console.log(`    Tax Credit: ₹${summary.financial.taxCredit || 0}`);

        console.log('\n  Workflow Flags:');
        console.log(`    Can Complete: ${summary.canComplete}`);
        console.log(`    Can Close: ${summary.canClose}`);

        return true;
    } else {
        console.error('✗ Failed to get lifecycle summary:', result.error);
        return false;
    }
}

async function testValidation() {
    console.log('\n=== Testing Validation Rules ===');

    // Test 1: Try to add SUPPLIED item without challan reference
    console.log('\nTest 1: SUPPLIED item without challan reference');
    const invalidSupplied = {
        invoiceid: testInvoiceId,
        productid: 1,
        itemtype: 'SUPPLIED',
        batch: 'TEST-BATCH',
        ptrvalue: 100.00,
        ptrcost: 1000.00,
        mrpcost: 120.00,
        qty: 10,
        total: 1000.00
        // Missing challanref
    };

    const result1 = await apiCall('POST', '/purchases/items', invalidSupplied);
    if (!result1.success && result1.status === 400) {
        console.log('✓ Correctly rejected SUPPLIED item without challan reference');
    } else {
        console.log('✗ Should have rejected invalid SUPPLIED item');
    }

    // Test 2: Try to add RETURN item without return reason
    console.log('\nTest 2: RETURN item without return reason');
    const invalidReturn = {
        invoiceid: testInvoiceId,
        productid: 1,
        itemtype: 'RETURN',
        batch: 'TEST-BATCH',
        ptrvalue: 100.00,
        ptrcost: 1000.00,
        mrpcost: 120.00,
        qty: 10,
        total: -1000.00
        // Missing returnreason
    };

    const result2 = await apiCall('POST', '/purchases/items', invalidReturn);
    if (!result2.success && result2.status === 400) {
        console.log('✓ Correctly rejected RETURN item without return reason');
    } else {
        console.log('✗ Should have rejected invalid RETURN item');
    }

    // Test 3: Try to complete invoice that's already complete
    console.log('\nTest 3: Double completion attempt');
    const result3 = await apiCall('POST', `/purchases/${testInvoiceId}/complete`, {});
    // This might succeed or fail depending on current status, just check response
    console.log(`  Response: ${result3.success ? 'Success' : 'Failed (expected)'}`);
}

async function cleanup() {
    console.log('\n=== Cleanup ===');
    console.log('Note: Test data left in database for verification');
    console.log(`Invoice ID: ${testInvoiceId}`);
    console.log(`Item IDs: ${testItemIds.join(', ')}`);
    console.log('\nTo manually cleanup:');
    console.log(`DELETE FROM purchase_invoice_item WHERE id IN (${testItemIds.join(',')});`);
    console.log(`DELETE FROM purchase_invoice WHERE id = ${testInvoiceId};`);
}

// Main test execution
async function runTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║    Invoice Lifecycle Management Test Suite            ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const startTime = Date.now();
    let passedTests = 0;
    let totalTests = 0;

    try {
        // Test 1: Authentication
        totalTests++;
        if (await login()) passedTests++;
        else return;

        // Test 2: Create Invoice
        totalTests++;
        if (await createInvoice()) passedTests++;
        else return;

        // Test 3: Add Items
        totalTests++;
        if (await addInvoiceItems()) passedTests++;

        // Test 4: Verify Items
        totalTests++;
        if (await verifyItems()) passedTests++;

        // Test 5: Complete Invoice
        totalTests++;
        if (await completeInvoice()) passedTests++;

        // Test 6: Check Closure Eligibility
        totalTests++;
        if (await checkClosureEligibility()) passedTests++;

        // Test 7: Get Lifecycle Summary
        totalTests++;
        if (await getLifecycleSummary()) passedTests++;

        // Test 8: Validation Rules
        totalTests++;
        if (await testValidation()) passedTests++;

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
