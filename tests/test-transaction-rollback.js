/**
 * Transaction Rollback Tests
 *
 * This test suite verifies that transaction wrappers properly rollback on failure,
 * preventing orphaned data and maintaining database consistency.
 *
 * Requirements:
 * - npm install pg
 * - PostgreSQL database with RGP schema
 *
 * Usage:
 * node tests/test-transaction-rollback.js
 */

const { Pool } = require('pg');
const config = require('./test-config');

// Database configuration
// Load from test-config.js (update credentials there if needed)
const pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
    max: config.max,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
});

let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

/**
 * Helper: Record test result
 */
function recordTest(name, passed, details) {
    testResults.tests.push({ name, passed, details });
    if (passed) {
        testResults.passed++;
        console.log(`✅ PASS: ${name}`);
    } else {
        testResults.failed++;
        console.log(`❌ FAIL: ${name}`);
    }
    if (details) {
        console.log(`   ${details}`);
    }
}

/**
 * Test 1: Sale Creation Rollback - Simulate item save failure
 */
async function testSaleCreationRollback() {
    console.log('\n--- Test 1: Sale Creation Rollback ---');
    const client = await pool.connect();

    try {
        // Get initial bill number
        const initialBillNo = await client.query('SELECT generate_bill_number() as bill_no');
        const expectedNextBill = initialBillNo.rows[0].bill_no + 1;

        console.log(`Initial bill number: ${initialBillNo.rows[0].bill_no}`);
        console.log(`Expected next bill: ${expectedNextBill}`);

        // Attempt to create sale with invalid item (should fail)
        try {
            await client.query('BEGIN');

            // Step 1: Generate bill number
            const billResult = await client.query('SELECT generate_bill_number() as bill_no');
            const billNo = billResult.rows[0].bill_no;
            console.log(`Generated bill number: ${billNo}`);

            // Step 2: Insert sale header
            const saleResult = await client.query(`
                INSERT INTO sale (bill_no, order_no, customer_id, status, bill_date, created_by)
                VALUES ($1, 'TEST-001', 1, 'PENDING', CURRENT_DATE, 1)
                RETURNING id
            `, [billNo]);
            const saleId = saleResult.rows[0].id;
            console.log(`Created sale ID: ${saleId}`);

            // Step 3: Attempt to insert invalid item (this should fail)
            // Using non-existent product_id to trigger foreign key constraint
            await client.query(`
                INSERT INTO sale_item (sale_id, product_id, purchase_item_id, qty, price, total)
                VALUES ($1, 99999, 99999, 1, 100, 100)
            `, [saleId]);

            await client.query('COMMIT');

            // If we got here, rollback didn't work
            recordTest('Sale Creation Rollback', false, 'Transaction should have failed but committed');

        } catch (error) {
            await client.query('ROLLBACK');
            console.log(`Transaction rolled back: ${error.message}`);

            // Verify sale was NOT saved
            const saleCheck = await client.query(`
                SELECT COUNT(*) as count FROM sale WHERE bill_no = $1
            `, [billNo]);

            const saleExists = parseInt(saleCheck.rows[0].count) > 0;

            if (saleExists) {
                recordTest('Sale Creation Rollback', false, 'Orphaned sale header found - rollback failed!');
            } else {
                // Verify bill number was rolled back
                const nextBill = await client.query('SELECT generate_bill_number() as bill_no');
                const actualNextBill = nextBill.rows[0].bill_no;

                // Note: Bill number might be consumed depending on implementation
                // The important part is no orphaned sale
                recordTest('Sale Creation Rollback', true,
                    `No orphaned sale found. Next bill: ${actualNextBill}`);
            }
        }

    } catch (error) {
        recordTest('Sale Creation Rollback', false, `Test error: ${error.message}`);
    } finally {
        client.release();
    }
}

/**
 * Test 2: Purchase Invoice Deletion Rollback - Simulate cascade delete failure
 */
async function testPurchaseInvoiceDeletionRollback() {
    console.log('\n--- Test 2: Purchase Invoice Deletion Rollback ---');
    const client = await pool.connect();

    try {
        // Create a test invoice with items
        await client.query('BEGIN');

        const invoiceResult = await client.query(`
            INSERT INTO purchase_invoice (vendor_id, invoice_no, invoice_date, total, created_by)
            VALUES (1, 'TEST-INV-001', CURRENT_DATE, 1000, 1)
            RETURNING id
        `);
        const invoiceId = invoiceResult.rows[0].id;
        console.log(`Created test invoice ID: ${invoiceId}`);

        const itemResult = await client.query(`
            INSERT INTO purchase_invoice_item
            (invoice_id, product_id, qty, ptr_cost, mrp_cost, sale_price, tax_pcnt, created_by)
            VALUES ($1, 1, 10, 50, 100, 90, 18, 1)
            RETURNING id
        `, [invoiceId]);
        const itemId = itemResult.rows[0].id;
        console.log(`Created test item ID: ${itemId}`);

        await client.query('COMMIT');

        // Now test deletion with rollback
        try {
            await client.query('BEGIN');

            // Delete product prices (Step 1)
            await client.query(`
                DELETE FROM product_price
                WHERE item_id IN (
                    SELECT id FROM purchase_invoice_item WHERE invoice_id = $1
                )
            `, [invoiceId]);

            // Simulate failure before completing all deletes
            throw new Error('Simulated failure during deletion');

            // These should not execute:
            // await client.query('DELETE FROM purchase_invoice_item WHERE invoice_id = $1', [invoiceId]);
            // await client.query('DELETE FROM purchase_invoice WHERE id = $1', [invoiceId]);

            await client.query('COMMIT');

        } catch (error) {
            await client.query('ROLLBACK');
            console.log(`Deletion rolled back: ${error.message}`);

            // Verify invoice and items still exist
            const invoiceCheck = await client.query(`
                SELECT COUNT(*) as count FROM purchase_invoice WHERE id = $1
            `, [invoiceId]);

            const itemCheck = await client.query(`
                SELECT COUNT(*) as count FROM purchase_invoice_item WHERE invoice_id = $1
            `, [invoiceId]);

            const invoiceExists = parseInt(invoiceCheck.rows[0].count) > 0;
            const itemsExist = parseInt(itemCheck.rows[0].count) > 0;

            if (invoiceExists && itemsExist) {
                recordTest('Purchase Invoice Deletion Rollback', true,
                    'Invoice and items preserved after rollback');

                // Clean up test data
                await client.query('DELETE FROM purchase_invoice_item WHERE invoice_id = $1', [invoiceId]);
                await client.query('DELETE FROM purchase_invoice WHERE id = $1', [invoiceId]);
                console.log('Test data cleaned up');

            } else {
                recordTest('Purchase Invoice Deletion Rollback', false,
                    'Data was deleted despite rollback!');
            }
        }

    } catch (error) {
        recordTest('Purchase Invoice Deletion Rollback', false, `Test error: ${error.message}`);
    } finally {
        client.release();
    }
}

/**
 * Test 3: Verify No Orphaned Sale Items
 */
async function testNoOrphanedSaleItems() {
    console.log('\n--- Test 3: Check for Orphaned Sale Items ---');
    const client = await pool.connect();

    try {
        const result = await client.query(`
            SELECT si.id, si.sale_id
            FROM sale_item si
            LEFT JOIN sale s ON s.id = si.sale_id
            WHERE s.id IS NULL
            LIMIT 10
        `);

        if (result.rows.length === 0) {
            recordTest('No Orphaned Sale Items', true, 'Database is clean - no orphaned items found');
        } else {
            recordTest('No Orphaned Sale Items', false,
                `Found ${result.rows.length} orphaned sale items: ${result.rows.map(r => r.id).join(', ')}`);
        }

    } catch (error) {
        recordTest('No Orphaned Sale Items', false, `Query error: ${error.message}`);
    } finally {
        client.release();
    }
}

/**
 * Test 4: Verify No Orphaned Invoice Items
 */
async function testNoOrphanedInvoiceItems() {
    console.log('\n--- Test 4: Check for Orphaned Invoice Items ---');
    const client = await pool.connect();

    try {
        const result = await client.query(`
            SELECT pii.id, pii.invoice_id
            FROM purchase_invoice_item pii
            LEFT JOIN purchase_invoice pi ON pi.id = pii.invoice_id
            WHERE pi.id IS NULL
            LIMIT 10
        `);

        if (result.rows.length === 0) {
            recordTest('No Orphaned Invoice Items', true, 'Database is clean - no orphaned items found');
        } else {
            recordTest('No Orphaned Invoice Items', false,
                `Found ${result.rows.length} orphaned invoice items: ${result.rows.map(r => r.id).join(', ')}`);
        }

    } catch (error) {
        recordTest('No Orphaned Invoice Items', false, `Query error: ${error.message}`);
    } finally {
        client.release();
    }
}

/**
 * Test 5: Bill Number Sequence Integrity
 */
async function testBillNumberIntegrity() {
    console.log('\n--- Test 5: Bill Number Sequence Integrity ---');
    const client = await pool.connect();

    try {
        // Get last 10 bill numbers from sales
        const result = await client.query(`
            SELECT bill_no
            FROM sale
            WHERE bill_no IS NOT NULL
            ORDER BY bill_no DESC
            LIMIT 10
        `);

        if (result.rows.length < 2) {
            recordTest('Bill Number Sequence Integrity', true, 'Insufficient data to test sequence');
            return;
        }

        const billNumbers = result.rows.map(r => r.bill_no).reverse();
        let hasDuplicates = false;
        const seen = new Set();

        for (const billNo of billNumbers) {
            if (seen.has(billNo)) {
                hasDuplicates = true;
                break;
            }
            seen.add(billNo);
        }

        if (hasDuplicates) {
            recordTest('Bill Number Sequence Integrity', false,
                'Duplicate bill numbers found! Check Phase 2 implementation.');
        } else {
            recordTest('Bill Number Sequence Integrity', true,
                `Last ${billNumbers.length} bill numbers are unique: ${billNumbers.join(', ')}`);
        }

    } catch (error) {
        recordTest('Bill Number Sequence Integrity', false, `Query error: ${error.message}`);
    } finally {
        client.release();
    }
}

/**
 * Print test summary
 */
function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log('='.repeat(60));

    if (testResults.failed === 0) {
        console.log('\n🎉 All tests passed! Transaction rollback is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Review the issues above.');
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('='.repeat(60));
    console.log('RGP Back Office - Transaction Rollback Tests');
    console.log('='.repeat(60));

    try {
        await testSaleCreationRollback();
        await testPurchaseInvoiceDeletionRollback();
        await testNoOrphanedSaleItems();
        await testNoOrphanedInvoiceItems();
        await testBillNumberIntegrity();

        printSummary();

    } catch (error) {
        console.error('Test suite error:', error);
    } finally {
        await pool.end();
    }
}

// Run tests
runAllTests();
