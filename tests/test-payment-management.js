/**
 * Test Script: Payment Management
 *
 * Tests payment tracking and reconciliation:
 * 1. Create invoice
 * 2. Create partial payment
 * 3. Check payment status (PARTIAL)
 * 4. Create additional payment
 * 5. Check payment status (PAID)
 * 6. Get payment summary
 * 7. Reconcile payments
 * 8. Update payment details
 * 9. Delete payment and verify status recalculation
 *
 * Run: node test-payment-management.js
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
let testPaymentIds = [];

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

async function createTestInvoice() {
    console.log('\n=== Creating Test Invoice ===');

    const invoiceData = {
        vendorid: 1,
        invoiceno: `PAY-TEST-${Date.now()}`,
        invoicedate: new Date().toISOString().split('T')[0],
        duedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total: 100000.00,
        taxamount: 18000.00,
        cgstamount: 9000.00,
        sgstamount: 9000.00
    };

    const result = await apiCall('POST', '/purchases', invoiceData);

    if (result.success) {
        testInvoiceId = result.data.id;
        console.log('✓ Invoice created successfully');
        console.log(`  Invoice ID: ${testInvoiceId}`);
        console.log(`  Total Amount: ₹${result.data.total}`);
        console.log(`  Payment Status: ${result.data.paymentstatus}`);
        return true;
    } else {
        console.error('✗ Invoice creation failed:', result.error);
        return false;
    }
}

async function createPartialPayment() {
    console.log('\n=== Creating Partial Payment ===');

    const paymentData = {
        paydate: new Date().toISOString().split('T')[0],
        amount: 40000.00,
        paymenttype: 'PARTIAL',
        paymentagainst: 'INVOICE',
        paymentstatus: 'COMPLETED',
        paymode: 'NEFT',
        transref: `TXN-${Date.now()}-1`,
        bankname: 'HDFC Bank',
        utrno: `UTR${Date.now()}1`,
        notes: 'First partial payment'
    };

    const result = await apiCall('POST', `/purchases/${testInvoiceId}/payments`, paymentData);

    if (result.success) {
        testPaymentIds.push(result.data.id);
        console.log('✓ Partial payment created successfully');
        console.log(`  Payment ID: ${result.data.id}`);
        console.log(`  Amount: ₹${result.data.amount}`);
        console.log(`  Payment Type: ${result.data.paymenttype}`);
        console.log(`  Mode: ${result.data.paymode}`);
        console.log(`  UTR: ${result.data.utrno}`);
        return true;
    } else {
        console.error('✗ Payment creation failed:', result.error);
        return false;
    }
}

async function checkPaymentStatusPartial() {
    console.log('\n=== Checking Payment Status (Should be PARTIAL) ===');

    const result = await apiCall('GET', `/purchases/${testInvoiceId}`);

    if (result.success) {
        console.log('✓ Invoice retrieved');
        console.log(`  Payment Status: ${result.data.paymentstatus}`);
        console.log(`  Paid Amount: ₹${result.data.paidamount || 0}`);
        console.log(`  Total: ₹${result.data.total}`);
        console.log(`  Outstanding: ₹${result.data.total - (result.data.paidamount || 0)}`);

        if (result.data.paymentstatus === 'PARTIAL') {
            console.log('✓ Payment status correctly updated to PARTIAL');
            return true;
        } else {
            console.log(`✗ Expected PARTIAL but got ${result.data.paymentstatus}`);
            return false;
        }
    } else {
        console.error('✗ Failed to retrieve invoice:', result.error);
        return false;
    }
}

async function createSecondPayment() {
    console.log('\n=== Creating Second Payment ===');

    const paymentData = {
        paydate: new Date().toISOString().split('T')[0],
        amount: 30000.00,
        paymenttype: 'PARTIAL',
        paymentagainst: 'INVOICE',
        paymentstatus: 'COMPLETED',
        paymode: 'UPI',
        transref: `TXN-${Date.now()}-2`,
        utrno: `UTR${Date.now()}2`,
        notes: 'Second partial payment'
    };

    const result = await apiCall('POST', `/purchases/${testInvoiceId}/payments`, paymentData);

    if (result.success) {
        testPaymentIds.push(result.data.id);
        console.log('✓ Second payment created successfully');
        console.log(`  Payment ID: ${result.data.id}`);
        console.log(`  Amount: ₹${result.data.amount}`);
        console.log(`  Cumulative Paid: ₹70,000`);
        return true;
    } else {
        console.error('✗ Payment creation failed:', result.error);
        return false;
    }
}

async function createFinalPayment() {
    console.log('\n=== Creating Final Payment ===');

    const paymentData = {
        paydate: new Date().toISOString().split('T')[0],
        amount: 30000.00,
        paymenttype: 'FULL',
        paymentagainst: 'INVOICE',
        paymentstatus: 'COMPLETED',
        paymode: 'CHEQUE',
        transref: `TXN-${Date.now()}-3`,
        bankname: 'ICICI Bank',
        chequeno: `CHQ${Date.now()}`,
        notes: 'Final payment - invoice fully paid'
    };

    const result = await apiCall('POST', `/purchases/${testInvoiceId}/payments`, paymentData);

    if (result.success) {
        testPaymentIds.push(result.data.id);
        console.log('✓ Final payment created successfully');
        console.log(`  Payment ID: ${result.data.id}`);
        console.log(`  Amount: ₹${result.data.amount}`);
        console.log(`  Payment Mode: ${result.data.paymode}`);
        console.log(`  Cheque No: ${result.data.chequeno}`);
        return true;
    } else {
        console.error('✗ Payment creation failed:', result.error);
        return false;
    }
}

async function checkPaymentStatusPaid() {
    console.log('\n=== Checking Payment Status (Should be PAID) ===');

    const result = await apiCall('GET', `/purchases/${testInvoiceId}`);

    if (result.success) {
        console.log('✓ Invoice retrieved');
        console.log(`  Payment Status: ${result.data.paymentstatus}`);
        console.log(`  Paid Amount: ₹${result.data.paidamount}`);
        console.log(`  Total: ₹${result.data.total}`);
        console.log(`  Outstanding: ₹${result.data.total - result.data.paidamount}`);

        if (result.data.paymentstatus === 'PAID') {
            console.log('✓ Payment status correctly updated to PAID');
            return true;
        } else {
            console.log(`✗ Expected PAID but got ${result.data.paymentstatus}`);
            return false;
        }
    } else {
        console.error('✗ Failed to retrieve invoice:', result.error);
        return false;
    }
}

async function getPaymentSummary() {
    console.log('\n=== Getting Payment Summary ===');

    const result = await apiCall('GET', `/purchases/${testInvoiceId}/payments/summary`);

    if (result.success) {
        const summary = result.data;
        console.log('✓ Payment summary retrieved');
        console.log('\n  Summary:');
        console.log(`    Invoice Total: ₹${summary.invoiceTotal}`);
        console.log(`    Total Paid: ₹${summary.totalPaid}`);
        console.log(`    Outstanding: ₹${summary.outstanding}`);
        console.log(`    Payment Status: ${summary.paymentStatus}`);
        console.log(`    Total Payments: ${summary.paymentCount}`);
        console.log(`    Completed Payments: ${summary.completedPaymentCount}`);

        console.log('\n  Payment Details:');
        summary.payments.forEach((payment, index) => {
            console.log(`\n    Payment ${index + 1}:`);
            console.log(`      ID: ${payment.id}`);
            console.log(`      Date: ${payment.date}`);
            console.log(`      Amount: ₹${payment.amount}`);
            console.log(`      Type: ${payment.type}`);
            console.log(`      Mode: ${payment.mode}`);
            console.log(`      Status: ${payment.status}`);
            console.log(`      Reconciled: ${payment.reconciled}`);
            if (payment.utrNo) console.log(`      UTR: ${payment.utrNo}`);
        });

        return true;
    } else {
        console.error('✗ Failed to get payment summary:', result.error);
        return false;
    }
}

async function reconcilePayment() {
    console.log('\n=== Reconciling Payment ===');

    if (testPaymentIds.length === 0) {
        console.error('✗ No payments to reconcile');
        return false;
    }

    const paymentId = testPaymentIds[0];
    const reconcileData = {
        reconciled: true,
        notes: 'Payment verified in bank statement'
    };

    const result = await apiCall('PUT', `/purchases/payments/${paymentId}/reconcile`, reconcileData);

    if (result.success) {
        console.log('✓ Payment reconciled successfully');
        console.log(`  Payment ID: ${paymentId}`);
        console.log('  Status: Reconciled');
        return true;
    } else {
        console.error('✗ Payment reconciliation failed:', result.error);
        return false;
    }
}

async function updatePayment() {
    console.log('\n=== Updating Payment Details ===');

    if (testPaymentIds.length < 2) {
        console.error('✗ Not enough payments to update');
        return false;
    }

    const paymentId = testPaymentIds[1];
    const updateData = {
        notes: 'Updated payment notes - verified with accounts team'
    };

    const result = await apiCall('PUT', `/purchases/payments/${paymentId}`, updateData);

    if (result.success) {
        console.log('✓ Payment updated successfully');
        console.log(`  Payment ID: ${paymentId}`);
        console.log('  Notes updated');
        return true;
    } else {
        console.error('✗ Payment update failed:', result.error);
        return false;
    }
}

async function deletePaymentAndVerify() {
    console.log('\n=== Deleting Payment and Verifying Status Recalculation ===');

    if (testPaymentIds.length < 3) {
        console.error('✗ Not enough payments to delete');
        return false;
    }

    const paymentId = testPaymentIds[2]; // Delete last payment

    console.log(`\nDeleting payment ${paymentId}...`);
    const deleteResult = await apiCall('DELETE', `/purchases/payments/${paymentId}`);

    if (!deleteResult.success) {
        console.error('✗ Payment deletion failed:', deleteResult.error);
        return false;
    }

    console.log('✓ Payment deleted successfully');

    // Verify status recalculation
    console.log('\nVerifying automatic status recalculation...');
    const invoiceResult = await apiCall('GET', `/purchases/${testInvoiceId}`);

    if (invoiceResult.success) {
        console.log('✓ Invoice status retrieved');
        console.log(`  Payment Status: ${invoiceResult.data.paymentstatus}`);
        console.log(`  Paid Amount: ₹${invoiceResult.data.paidamount}`);
        console.log(`  Outstanding: ₹${invoiceResult.data.total - invoiceResult.data.paidamount}`);

        // After deleting 30,000 payment, should be back to PARTIAL (70,000/100,000)
        if (invoiceResult.data.paymentstatus === 'PARTIAL' && invoiceResult.data.paidamount === 70000) {
            console.log('✓ Status correctly recalculated to PARTIAL after deletion');
            return true;
        } else {
            console.log('✗ Status not correctly recalculated');
            return false;
        }
    } else {
        console.error('✗ Failed to retrieve invoice:', invoiceResult.error);
        return false;
    }
}

async function testAdvancePayment() {
    console.log('\n=== Testing Advance Payment ===');

    // Create a new invoice for advance payment test
    const invoiceData = {
        vendorid: 1,
        invoiceno: `ADV-TEST-${Date.now()}`,
        invoicedate: new Date().toISOString().split('T')[0],
        total: 50000.00
    };

    const invoiceResult = await apiCall('POST', '/purchases', invoiceData);
    if (!invoiceResult.success) {
        console.error('✗ Failed to create test invoice');
        return false;
    }

    const advInvoiceId = invoiceResult.data.id;
    console.log(`✓ Test invoice created (ID: ${advInvoiceId})`);

    // Create advance payment (more than invoice amount)
    const advancePayment = {
        paydate: new Date().toISOString().split('T')[0],
        amount: 60000.00,
        paymenttype: 'ADVANCE',
        paymentstatus: 'COMPLETED',
        paymode: 'NEFT',
        notes: 'Advance payment - excess amount'
    };

    const paymentResult = await apiCall('POST', `/purchases/${advInvoiceId}/payments`, advancePayment);

    if (paymentResult.success) {
        console.log('✓ Advance payment created');
        console.log(`  Amount: ₹${paymentResult.data.amount} (exceeds invoice total)`);

        // Check invoice status
        const statusResult = await apiCall('GET', `/purchases/${advInvoiceId}`);
        if (statusResult.success) {
            console.log(`  Payment Status: ${statusResult.data.paymentstatus}`);
            console.log(`  Paid: ₹${statusResult.data.paidamount} / ₹${statusResult.data.total}`);

            if (statusResult.data.paymentstatus === 'PAID') {
                console.log('✓ Advance payment correctly marked as PAID');
                return true;
            }
        }
    }

    console.error('✗ Advance payment test failed');
    return false;
}

async function cleanup() {
    console.log('\n=== Cleanup ===');
    console.log('Note: Test data left in database for verification');
    console.log(`Invoice ID: ${testInvoiceId}`);
    console.log(`Payment IDs: ${testPaymentIds.join(', ')}`);
}

// Main test execution
async function runTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         Payment Management Test Suite                 ║');
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
        if (await createTestInvoice()) passedTests++;
        else return;

        // Test 3: Create Partial Payment
        totalTests++;
        if (await createPartialPayment()) passedTests++;

        // Test 4: Check PARTIAL Status
        totalTests++;
        if (await checkPaymentStatusPartial()) passedTests++;

        // Test 5: Create Second Payment
        totalTests++;
        if (await createSecondPayment()) passedTests++;

        // Test 6: Create Final Payment
        totalTests++;
        if (await createFinalPayment()) passedTests++;

        // Test 7: Check PAID Status
        totalTests++;
        if (await checkPaymentStatusPaid()) passedTests++;

        // Test 8: Get Payment Summary
        totalTests++;
        if (await getPaymentSummary()) passedTests++;

        // Test 9: Reconcile Payment
        totalTests++;
        if (await reconcilePayment()) passedTests++;

        // Test 10: Update Payment
        totalTests++;
        if (await updatePayment()) passedTests++;

        // Test 11: Delete and Verify Recalculation
        totalTests++;
        if (await deletePaymentAndVerify()) passedTests++;

        // Test 12: Advance Payment
        totalTests++;
        if (await testAdvancePayment()) passedTests++;

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
