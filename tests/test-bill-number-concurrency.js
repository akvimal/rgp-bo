/**
 * Concurrent Bill Number Generation Test
 *
 * This test simulates multiple concurrent transactions calling generate_bill_number()
 * to verify that the SELECT FOR UPDATE locking prevents duplicate bill numbers.
 *
 * Requirements:
 * - npm install pg
 * - PostgreSQL database with sales_meta table
 *
 * Usage:
 * node tests/test-bill-number-concurrency.js
 */

const { Pool } = require('pg');
const config = require('./test-config');

// Database configuration
// Load from test-config.js (update credentials there if needed)
const pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
    max: 20, // Allow multiple concurrent connections
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
});

/**
 * Simulates a single sale transaction that generates a bill number
 */
async function simulateSale(transactionId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const startTime = Date.now();
        const result = await client.query('SELECT generate_bill_number() as bill_no');
        const endTime = Date.now();

        const billNo = result.rows[0].bill_no;

        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

        await client.query('COMMIT');

        console.log(`Transaction ${transactionId}: Bill No = ${billNo}, Time = ${endTime - startTime}ms`);
        return billNo;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction ${transactionId} failed:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Runs concurrent bill number generation test
 */
async function runConcurrencyTest(numTransactions = 100) {
    console.log('='.repeat(60));
    console.log('Bill Number Concurrency Test');
    console.log('='.repeat(60));
    console.log(`Testing with ${numTransactions} concurrent transactions...\n`);

    const startTime = Date.now();

    // Create array of promises for concurrent execution
    const promises = [];
    for (let i = 1; i <= numTransactions; i++) {
        promises.push(simulateSale(i));
    }

    try {
        // Wait for all transactions to complete
        const billNumbers = await Promise.all(promises);
        const endTime = Date.now();

        // Analyze results
        console.log('\n' + '='.repeat(60));
        console.log('Test Results');
        console.log('='.repeat(60));

        const uniqueBillNumbers = new Set(billNumbers);
        const duplicates = billNumbers.length - uniqueBillNumbers.size;

        console.log(`Total transactions: ${billNumbers.length}`);
        console.log(`Unique bill numbers: ${uniqueBillNumbers.size}`);
        console.log(`Duplicates found: ${duplicates}`);
        console.log(`Total time: ${endTime - startTime}ms`);
        console.log(`Average time per transaction: ${((endTime - startTime) / numTransactions).toFixed(2)}ms`);

        // Verify sequential bill numbers
        const sortedBillNos = billNumbers.sort((a, b) => a - b);
        const minBillNo = sortedBillNos[0];
        const maxBillNo = sortedBillNos[sortedBillNos.length - 1];
        const expectedMax = minBillNo + numTransactions - 1;

        console.log(`\nBill number range: ${minBillNo} to ${maxBillNo}`);
        console.log(`Expected range: ${minBillNo} to ${expectedMax}`);

        if (duplicates === 0 && maxBillNo === expectedMax) {
            console.log('\n✅ SUCCESS: No race condition detected!');
            console.log('All bill numbers are unique and sequential.');
        } else {
            console.log('\n❌ FAILURE: Race condition detected!');
            if (duplicates > 0) {
                console.log(`Found ${duplicates} duplicate bill numbers.`);
            }
            if (maxBillNo !== expectedMax) {
                console.log('Bill numbers are not sequential.');
            }
        }

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
    } finally {
        console.log('='.repeat(60));
        await pool.end();
    }
}

/**
 * Initialize test - ensure sales_meta table has data
 */
async function initializeTest() {
    const client = await pool.connect();
    try {
        // Check if sales_meta has data
        const result = await client.query('SELECT COUNT(*) FROM sales_meta');
        if (result.rows[0].count === '0') {
            console.log('Initializing sales_meta table...');
            const currentFiscalYear = new Date();
            currentFiscalYear.setMonth(3); // April 1st
            if (new Date().getMonth() < 3) {
                currentFiscalYear.setFullYear(currentFiscalYear.getFullYear() - 1);
            }

            await client.query(
                'INSERT INTO sales_meta (fiscal_year_start, last_bill_no) VALUES ($1, $2)',
                [currentFiscalYear.toISOString().split('T')[0], 0]
            );
            console.log('Initialization complete.\n');
        }
    } catch (error) {
        console.error('Initialization failed:', error.message);
    } finally {
        client.release();
    }
}

// Run the test
(async () => {
    try {
        await initializeTest();
        await runConcurrencyTest(100); // Test with 100 concurrent transactions
    } catch (error) {
        console.error('Test execution failed:', error);
        process.exit(1);
    }
})();
