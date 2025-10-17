/**
 * Simple Database Connection Test
 *
 * This script verifies that the database credentials in test-config.js are correct
 * and that PostgreSQL is accessible.
 *
 * Usage:
 * node tests/test-connection.js
 */

const { Pool } = require('pg');
const config = require('./test-config');

async function testConnection() {
    console.log('='.repeat(60));
    console.log('Database Connection Test');
    console.log('='.repeat(60));
    console.log('\nAttempting to connect to PostgreSQL...');
    console.log(`Connection string: ${config.connectionString.replace(/:([^:]+)@/, ':****@')}`);

    const pool = new Pool({
        connectionString: config.connectionString,
        ssl: config.ssl,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
    });

    try {
        // Test 1: Basic connection
        console.log('\n--- Test 1: Basic Connection ---');
        const result = await pool.query('SELECT NOW(), version() as pg_version');
        console.log('✅ Database connection successful!');
        console.log(`Server time: ${result.rows[0].now}`);
        console.log(`PostgreSQL version: ${result.rows[0].pg_version.split(',')[0]}`);

        // Test 2: Check if rgpdb database exists
        console.log('\n--- Test 2: Database Verification ---');
        const dbResult = await pool.query(`
            SELECT current_database(), current_user
        `);
        console.log(`✅ Connected to database: ${dbResult.rows[0].current_database}`);
        console.log(`✅ Connected as user: ${dbResult.rows[0].current_user}`);

        // Test 3: Check if key tables exist
        console.log('\n--- Test 3: Schema Verification ---');
        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('sale', 'sale_item', 'purchase_invoice', 'purchase_invoice_item', 'sales_meta')
            ORDER BY table_name
        `);

        if (tablesResult.rows.length === 0) {
            console.log('⚠️  Warning: No RGP tables found. Have you applied the schema?');
        } else {
            console.log(`✅ Found ${tablesResult.rows.length} RGP tables:`);
            tablesResult.rows.forEach(row => {
                console.log(`   - ${row.table_name}`);
            });
        }

        // Test 4: Check if generate_bill_number function exists
        console.log('\n--- Test 4: Function Verification ---');
        const funcResult = await pool.query(`
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name IN ('generate_bill_number', 'generate_order_number')
            ORDER BY routine_name
        `);

        if (funcResult.rows.length === 0) {
            console.log('⚠️  Warning: Required functions not found. Have you applied sql/ddl/functions.sql?');
        } else {
            console.log(`✅ Found ${funcResult.rows.length} required functions:`);
            funcResult.rows.forEach(row => {
                console.log(`   - ${row.routine_name}()`);
            });
        }

        // Test 5: Check if sales_meta has data
        const tablesExist = tablesResult.rows.some(row => row.table_name === 'sales_meta');
        if (tablesExist) {
            console.log('\n--- Test 5: Sales Meta Data ---');
            const metaResult = await pool.query(`
                SELECT COUNT(*) as count FROM sales_meta
            `);

            if (metaResult.rows[0].count === '0') {
                console.log('⚠️  Warning: sales_meta table is empty. Tests may fail.');
                console.log('   Initialize with: INSERT INTO sales_meta (fiscal_year_start, last_bill_no) VALUES (CURRENT_DATE, 0)');
            } else {
                console.log(`✅ sales_meta table has ${metaResult.rows[0].count} record(s)`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 All connection tests passed!');
        console.log('='.repeat(60));
        console.log('\nYou can now run the full test suites:');
        console.log('  - node test-bill-number-concurrency.js');
        console.log('  - node test-transaction-rollback.js');
        console.log('='.repeat(60));

    } catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ Connection failed!');
        console.log('='.repeat(60));
        console.error('\nError details:');
        console.error(`  Code: ${error.code}`);
        console.error(`  Message: ${error.message}`);

        console.log('\n' + '='.repeat(60));
        console.log('Troubleshooting Steps:');
        console.log('='.repeat(60));

        if (error.code === '28P01') {
            console.log('\n1. Password Authentication Failed:');
            console.log('   - Update test-config.js with correct credentials');
            console.log('   - Check api-v2/.env for working credentials');
            console.log('   - Verify user exists: psql -U postgres -c "\\du"');
        } else if (error.code === '3D000') {
            console.log('\n1. Database Does Not Exist:');
            console.log('   - Create database: CREATE DATABASE rgpdb;');
            console.log('   - Grant access: GRANT ALL PRIVILEGES ON DATABASE rgpdb TO rgpapp;');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\n1. Connection Refused:');
            console.log('   - Check if PostgreSQL is running');
            console.log('   - Verify port 5432 is listening: netstat -an | findstr ":5432"');
            console.log('   - Check postgresql.conf: listen_addresses = \'localhost\'');
        } else {
            console.log('\n1. Unexpected Error:');
            console.log('   - Check PostgreSQL logs for details');
            console.log('   - Verify pg_hba.conf allows connections from localhost');
        }

        console.log('\n2. For more help, see tests/CONFIGURATION_GUIDE.md');
        console.log('='.repeat(60));

    } finally {
        await pool.end();
    }
}

// Run the test
testConnection();
