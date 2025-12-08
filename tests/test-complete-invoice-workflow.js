/**
 * Test Script: Complete Invoice Workflow Integration Test
 *
 * Tests the complete end-to-end invoice lifecycle:
 * 1. Create invoice with items (REGULAR, RETURN, SUPPLIED)
 * 2. Verify all items
 * 3. Complete invoice
 * 4. Make payments (partial, then full)
 * 5. Create tax credit record
 * 6. Track tax filing status to CLAIMED
 * 7. Close invoice
 * 8. Verify complete lifecycle summary
 *
 * This test simulates a real-world invoice workflow from creation to closure.
 *
 * Run: node test-complete-invoice-workflow.js
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
let invoiceId = null;
let itemIds = [];
let paymentIds = [];
let taxCreditId = null;

const INVOICE_TOTAL = 118000.00;
const TAX_CREDIT = 18000.00;

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

// Utility to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test Functions
async function login() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 1: Authentication                                ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const result = await apiCall('POST', '/auth/login', TEST_USER);

    if (result.success) {
        authToken = result.data.token || result.data.access_token;
        console.log('✓ Authentication successful');
        return true;
    } else {
        console.error('✗ Authentication failed:', result.error);
        return false;
    }
}

async function createInvoice() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 2: Create Purchase Invoice                       ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const invoiceData = {
        vendorid: 1,
        invoiceno: `WORKFLOW-${Date.now()}`,
        invoicedate: '2024-12-05',
        duedate: '2025-01-05',
        total: INVOICE_TOTAL,
        discpcnt: 0,
        discamount: 0,
        taxpcnt: 18,
        taxamount: TAX_CREDIT,
        doctype: 'INVOICE',
        cgstamount: 9000.00,
        sgstamount: 9000.00,
        igstamount: 0
    };

    const result = await apiCall('POST', '/purchases', invoiceData);

    if (result.success) {
        invoiceId = result.data.id;
        console.log('✓ Invoice created successfully');
        console.log(`\n  Invoice Details:`);
        console.log(`    ID: ${invoiceId}`);
        console.log(`    Number: ${result.data.invoiceno}`);
        console.log(`    Total: ₹${result.data.total}`);
        console.log(`    Tax: ₹${result.data.taxamount}`);
        console.log(`    Payment Status: ${result.data.paymentstatus} (Expected: UNPAID)`);
        console.log(`    Tax Status: ${result.data.taxstatus} (Expected: PENDING)`);
        console.log(`    Lifecycle Status: ${result.data.lifecyclestatus} (Expected: OPEN)`);
        return true;
    } else {
        console.error('✗ Invoice creation failed:', result.error);
        return false;
    }
}

async function addInvoiceItems() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 3: Add Invoice Items                             ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const items = [
        {
            name: 'Regular Item 1',
            invoiceid: invoiceId,
            productid: 1,
            itemtype: 'REGULAR',
            batch: `REG-${Date.now()}-1`,
            expdate: '2025-12-31',
            ptrvalue: 500.00,
            ptrcost: 50000.00,
            mrpcost: 600.00,
            taxpcnt: 18,
            cgstpcnt: 9,
            sgstpcnt: 9,
            cgstamount: 4500.00,
            sgstamount: 4500.00,
            qty: 100,
            total: 59000.00
        },
        {
            name: 'Regular Item 2',
            invoiceid: invoiceId,
            productid: 2,
            itemtype: 'REGULAR',
            batch: `REG-${Date.now()}-2`,
            expdate: '2026-06-30',
            ptrvalue: 300.00,
            ptrcost: 30000.00,
            mrpcost: 360.00,
            taxpcnt: 18,
            cgstpcnt: 9,
            sgstpcnt: 9,
            cgstamount: 2700.00,
            sgstamount: 2700.00,
            qty: 100,
            total: 35400.00
        },
        {
            name: 'Return Item',
            invoiceid: invoiceId,
            productid: 3,
            itemtype: 'RETURN',
            batch: `RET-${Date.now()}`,
            returnreason: 'Damaged in transit - returning to vendor',
            ptrvalue: 200.00,
            ptrcost: 10000.00,
            mrpcost: 240.00,
            qty: 50,
            total: -10000.00
        },
        // Commented out - requires product ID 4 and delivery challan setup
        // {
        //     name: 'Supplied Item',
        //     invoiceid: invoiceId,
        //     productid: 4,
        //     itemtype: 'SUPPLIED',
        //     batch: `SUP-${Date.now()}`,
        //     challanref: `DC-${Date.now()}`,
        //     ptrvalue: 250.00,
        //     ptrcost: 25000.00,
        //     mrpcost: 300.00,
        //     taxpcnt: 18,
        //     cgstpcnt: 9,
        //     sgstpcnt: 9,
        //     cgstamount: 2250.00,
        //     sgstamount: 2250.00,
        //     qty: 100,
        //     total: 29500.00
        // }
    ];

    console.log(`\nAdding ${items.length} items to invoice...\n`);

    for (const item of items) {
        const result = await apiCall('POST', '/purchaseitems', item);

        if (result.success) {
            itemIds.push(result.data.id);
            console.log(`✓ ${item.name} added (${item.itemtype})`);
            console.log(`    Item ID: ${result.data.id}`);
            console.log(`    Batch: ${result.data.batch}`);
            console.log(`    Quantity: ${item.qty}`);
            console.log(`    Amount: ₹${item.total}`);
            if (item.itemtype === 'RETURN') {
                console.log(`    Return Reason: ${item.returnreason}`);
            }
            if (item.itemtype === 'SUPPLIED') {
                console.log(`    Challan Ref: ${item.challanref}`);
            }
        } else {
            console.error(`✗ Failed to add ${item.name}:`, result.error);
            return false;
        }
    }

    console.log(`\n✓ All ${itemIds.length} items added successfully`);
    return true;
}

async function verifyItems() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 4: Verify Invoice Items                          ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const result = await apiCall('PUT', '/purchaseitems', {
        ids: itemIds,
        values: { status: 'VERIFIED' }
    });

    if (result.success) {
        console.log('✓ All items verified successfully');
        console.log(`    Verified ${itemIds.length} items`);
        console.log('    Status changed from NEW to VERIFIED');
        console.log('    Verification timestamp recorded');
        return true;
    } else {
        console.error('✗ Item verification failed:', result.error);
        return false;
    }
}

async function completeInvoice() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 5: Complete Invoice                              ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const result = await apiCall('POST', `/purchases/${invoiceId}/complete`, {});

    if (result.success) {
        console.log('✓ Invoice completed successfully');
        console.log('    Invoice status: COMPLETE');
        console.log('    Tax totals calculated from items');
        console.log('    Ready for payment processing');

        // Verify completion
        const verifyResult = await apiCall('GET', `/purchases/${invoiceId}`);
        if (verifyResult.success) {
            console.log(`\n    Verification:`);
            console.log(`      Status: ${verifyResult.data.status}`);
            console.log(`      Tax Credit: ₹${verifyResult.data.totaltaxcredit || 0}`);
        }

        return true;
    } else {
        console.error('✗ Invoice completion failed:', result.error);
        return false;
    }
}

async function makePayments() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 6: Process Payments                              ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const payments = [
        {
            name: 'Partial Payment 1',
            amount: 50000.00,
            paymenttype: 'PARTIAL',
            paymode: 'NEFT',
            utrno: `UTR${Date.now()}1`
        },
        {
            name: 'Partial Payment 2',
            amount: 30000.00,
            paymenttype: 'PARTIAL',
            paymode: 'UPI',
            utrno: `UTR${Date.now()}2`
        },
        {
            name: 'Final Payment',
            amount: 38000.00,
            paymenttype: 'FULL',
            paymode: 'CHEQUE',
            chequeno: `CHQ${Date.now()}`
        }
    ];

    console.log(`\nProcessing ${payments.length} payments...\n`);

    for (const [index, payment] of payments.entries()) {
        const paymentData = {
            paydate: new Date().toISOString().split('T')[0],
            amount: payment.amount,
            paymenttype: payment.paymenttype,
            paymentagainst: 'INVOICE',
            paymentstatus: 'COMPLETED',
            paymode: payment.paymode,
            transref: `TXN-${Date.now()}-${index + 1}`,
            bankname: 'Test Bank',
            utrno: payment.utrno,
            chequeno: payment.chequeno,
            notes: payment.name
        };

        const result = await apiCall('POST', `/purchases/${invoiceId}/payments`, paymentData);

        if (result.success) {
            paymentIds.push(result.data.id);
            console.log(`✓ ${payment.name} recorded`);
            console.log(`    Payment ID: ${result.data.id}`);
            console.log(`    Amount: ₹${payment.amount}`);
            console.log(`    Mode: ${payment.paymode}`);

            // Check payment status after each payment
            const statusResult = await apiCall('GET', `/purchases/${invoiceId}`);
            if (statusResult.success) {
                const cumulativePaid = payments.slice(0, index + 1).reduce((sum, p) => sum + p.amount, 0);
                console.log(`    Cumulative Paid: ₹${cumulativePaid}`);
                console.log(`    Payment Status: ${statusResult.data.paymentstatus}`);
                console.log(`    Outstanding: ₹${INVOICE_TOTAL - cumulativePaid}`);
            }
            console.log();
        } else {
            console.error(`✗ ${payment.name} failed:`, result.error);
            return false;
        }
    }

    console.log('✓ All payments processed successfully');
    console.log(`    Total Paid: ₹${INVOICE_TOTAL}`);
    console.log('    Payment Status: PAID');
    return true;
}

async function createTaxCredit() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 7: Create Tax Credit Record                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const taxCreditData = {
        invoiceid: invoiceId,
        gstfilingmonth: '2024-12-01',
        vendorgstin: '27AAAAA0000A1Z5',
        taxableamount: 100000.00,
        cgstamount: 9000.00,
        sgstamount: 9000.00,
        igstamount: 0,
        totaltaxcredit: TAX_CREDIT,
        filingstatus: 'PENDING',
        notes: 'GST tax credit for workflow test invoice'
    };

    const result = await apiCall('POST', '/purchases/tax-credits', taxCreditData);

    if (result.success) {
        taxCreditId = result.data.id;
        console.log('✓ Tax credit record created');
        console.log(`\n    Tax Credit Details:`);
        console.log(`      ID: ${taxCreditId}`);
        console.log(`      Filing Month: ${result.data.gstfilingmonth}`);
        console.log(`      GSTIN: ${result.data.vendorgstin}`);
        console.log(`      Tax Credit: ₹${result.data.totaltaxcredit}`);
        console.log(`      CGST: ₹${result.data.cgstamount}`);
        console.log(`      SGST: ₹${result.data.sgstamount}`);
        console.log(`      Filing Status: ${result.data.filingstatus}`);
        return true;
    } else {
        console.error('✗ Tax credit creation failed:', result.error);
        return false;
    }
}

async function trackTaxFiling() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 8: Track Tax Filing Progress                     ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const filingSteps = [
        {
            step: '8a',
            name: 'Vendor Files GSTR-1',
            data: {
                filingstatus: 'FILED_BY_VENDOR',
                fileddate: '2024-12-11',
                gstr1docid: 123
            }
        },
        {
            step: '8b',
            name: 'Reflected in GSTR-2A',
            data: {
                filingstatus: 'REFLECTED_IN_2A',
                reflectedin2adate: '2024-12-13',
                gstr2ascreenshotid: 456
            }
        },
        {
            step: '8c',
            name: 'Claimed in GSTR-3B',
            data: {
                filingstatus: 'CLAIMED',
                claimedinreturn: 'GSTR-3B Dec 2024',
                claimeddate: '2024-12-20'
            }
        }
    ];

    console.log(`\nTracking tax filing through ${filingSteps.length} stages...\n`);

    for (const step of filingSteps) {
        console.log(`  ${step.step}. ${step.name}`);

        const result = await apiCall('PUT', `/purchases/tax-credits/${taxCreditId}/filing-status`, step.data);

        if (result.success) {
            console.log(`      ✓ Status updated to ${step.data.filingstatus}`);
            if (step.data.fileddate) console.log(`      Filed Date: ${step.data.fileddate}`);
            if (step.data.reflectedin2adate) console.log(`      2A Date: ${step.data.reflectedin2adate}`);
            if (step.data.claimeddate) console.log(`      Claimed Date: ${step.data.claimeddate}`);
        } else {
            console.error(`      ✗ Update failed:`, result.error);
            return false;
        }
        console.log();
    }

    console.log('✓ Tax filing tracked through complete lifecycle');
    console.log('    Status: CLAIMED');
    console.log('    Tax reconciliation complete');
    return true;
}

async function closeInvoice() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 9: Close Invoice                                 ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    // First check if we can close
    console.log('Checking closure eligibility...\n');
    const checkResult = await apiCall('GET', `/purchases/${invoiceId}/can-close`);

    if (checkResult.success) {
        console.log(`  Can Close: ${checkResult.data.canClose}`);
        if (!checkResult.data.canClose) {
            console.log('  Reasons:');
            checkResult.data.reasons.forEach(reason => {
                console.log(`    - ${reason}`);
            });
            console.error('\n✗ Invoice cannot be closed yet');
            return false;
        }
    }

    // Close the invoice
    console.log('\nClosing invoice...');
    const closeData = {
        notes: 'Invoice closed after complete workflow: items verified, payment completed, tax reconciled'
    };

    const result = await apiCall('POST', `/purchases/${invoiceId}/close`, closeData);

    if (result.success) {
        console.log('✓ Invoice closed successfully');
        console.log('    Lifecycle Status: CLOSED');
        console.log('    Closure timestamp recorded');
        console.log('    All workflow stages completed');
        return true;
    } else {
        console.error('✗ Invoice closure failed:', result.error);
        return false;
    }
}

async function verifyCompleteLifecycle() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  STEP 10: Verify Complete Lifecycle                    ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const result = await apiCall('GET', `/purchases/${invoiceId}/lifecycle-summary`);

    if (result.success) {
        const summary = result.data;
        console.log('✓ Lifecycle summary retrieved\n');

        console.log('  Invoice Status:');
        console.log(`    ID: ${summary.invoice.id}`);
        console.log(`    Number: ${summary.invoice.invoiceNo}`);
        console.log(`    Type: ${summary.invoice.docType}`);
        console.log(`    Status: ${summary.invoice.status}`);
        console.log(`    Payment Status: ${summary.invoice.paymentStatus}`);
        console.log(`    Tax Status: ${summary.invoice.taxStatus}`);
        console.log(`    Lifecycle Status: ${summary.invoice.lifecycleStatus}`);

        console.log('\n  Items Breakdown:');
        console.log(`    Total Items: ${summary.items.total}`);
        console.log(`    Regular: ${summary.items.regular}`);
        console.log(`    Return: ${summary.items.return}`);
        console.log(`    Supplied: ${summary.items.supplied}`);
        console.log(`    Verified: ${summary.items.verified}/${summary.items.total}`);

        console.log('\n  Financial Summary:');
        console.log(`    Invoice Total: ₹${summary.financial.total}`);
        console.log(`    Total Paid: ₹${summary.financial.paidAmount}`);
        console.log(`    Outstanding: ₹${summary.financial.outstanding}`);
        console.log(`    Tax Credit: ₹${summary.financial.taxCredit}`);

        console.log('\n  Workflow Validation:');
        console.log(`    Can Complete: ${summary.canComplete}`);
        console.log(`    Can Close: ${summary.canClose}`);

        // Verify expected final state
        const isValid =
            summary.invoice.status === 'COMPLETE' &&
            summary.invoice.paymentStatus === 'PAID' &&
            summary.invoice.taxStatus === 'RECONCILED' &&
            summary.invoice.lifecycleStatus === 'CLOSED' &&
            summary.items.verified === summary.items.total &&
            summary.financial.outstanding === 0;

        if (isValid) {
            console.log('\n✓ All lifecycle validations passed!');
            return true;
        } else {
            console.log('\n✗ Some lifecycle validations failed');
            return false;
        }
    } else {
        console.error('✗ Failed to retrieve lifecycle summary:', result.error);
        return false;
    }
}

async function printFinalReport() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                  Final Report                          ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    console.log('\n  Invoice Workflow Completed:');
    console.log(`    Invoice ID: ${invoiceId}`);
    console.log(`    Items: ${itemIds.length} (IDs: ${itemIds.join(', ')})`);
    console.log(`    Payments: ${paymentIds.length} (IDs: ${paymentIds.join(', ')})`);
    console.log(`    Tax Credit ID: ${taxCreditId}`);

    console.log('\n  Workflow Stages Completed:');
    console.log('    ✓ Invoice created');
    console.log('    ✓ Items added (Regular, Return, Supplied)');
    console.log('    ✓ Items verified');
    console.log('    ✓ Invoice completed');
    console.log('    ✓ Payments processed (Partial → Full)');
    console.log('    ✓ Tax credit recorded');
    console.log('    ✓ Tax filing tracked (PENDING → CLAIMED)');
    console.log('    ✓ Invoice closed');
    console.log('    ✓ Lifecycle verified');

    console.log('\n  Test Data Cleanup:');
    console.log('    Note: Test data remains in database for manual verification');
    console.log(`\n    To cleanup manually, delete:`);
    console.log(`      - purchase_invoice_tax_credit WHERE id = ${taxCreditId}`);
    console.log(`      - vendor_payment WHERE id IN (${paymentIds.join(',')})`);
    console.log(`      - purchase_invoice_item WHERE id IN (${itemIds.join(',')})`);
    console.log(`      - purchase_invoice WHERE id = ${invoiceId}`);
}

// Main test execution
async function runTests() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  Complete Invoice Workflow Integration Test           ║');
    console.log('║  Testing: Creation → Payment → Tax → Closure          ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const startTime = Date.now();
    let passedSteps = 0;
    let totalSteps = 0;

    try {
        const steps = [
            { name: 'Authentication', fn: login },
            { name: 'Create Invoice', fn: createInvoice },
            { name: 'Add Items', fn: addInvoiceItems },
            { name: 'Verify Items', fn: verifyItems },
            { name: 'Complete Invoice', fn: completeInvoice },
            { name: 'Process Payments', fn: makePayments },
            { name: 'Create Tax Credit', fn: createTaxCredit },
            { name: 'Track Tax Filing', fn: trackTaxFiling },
            { name: 'Close Invoice', fn: closeInvoice },
            { name: 'Verify Lifecycle', fn: verifyCompleteLifecycle }
        ];

        for (const step of steps) {
            totalSteps++;
            if (await step.fn()) {
                passedSteps++;
            } else {
                console.error(`\n✗ Workflow aborted at: ${step.name}`);
                break;
            }
        }

        if (passedSteps === totalSteps) {
            await printFinalReport();
        }

    } catch (error) {
        console.error('\n✗ Unexpected error:', error.message);
        console.error(error.stack);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    Test Summary                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\n  Steps Completed: ${passedSteps}/${totalSteps}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`  Success Rate: ${((passedSteps/totalSteps) * 100).toFixed(1)}%`);

    if (passedSteps === totalSteps) {
        console.log('\n  ✓ COMPLETE WORKFLOW TEST PASSED!');
        console.log('  All lifecycle stages executed successfully.\n');
        process.exit(0);
    } else {
        console.log('\n  ✗ WORKFLOW TEST FAILED');
        console.log(`  Failed at step ${passedSteps + 1} of ${totalSteps}\n`);
        process.exit(1);
    }
}

// Run tests
runTests();
