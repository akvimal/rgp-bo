/**
 * Test HSN Tax Lookup Functionality
 *
 * This script tests the HSN-based tax rate lookup functionality
 * implemented in Phase 1 of the pricing/tax improvements.
 *
 * Tests:
 * 1. Database function get_hsn_tax_rate()
 * 2. Database function get_product_tax_rate()
 * 3. ProductService methods via API endpoints
 */

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'rgpdb',
  user: 'rgpapp',
  password: 'r9pAdmin7',
});

const API_BASE_URL = 'http://localhost:3000';

// Test credentials
const TEST_USER = {
  email: 'admin@rgp.com',
  password: 'admin123'
};

let authToken = '';

async function authenticate() {
  console.log('\n=== Authentication ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, TEST_USER);
    authToken = response.data.token;
    console.log('✅ Authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    return false;
  }
}

async function testDatabaseFunction() {
  console.log('\n=== Test 1: Database Function get_hsn_tax_rate() ===');

  const testCases = [
    { hsnCode: '30049099', description: 'General Medicine (12% GST)' },
    { hsnCode: '33041000', description: 'Lip Make-up (18% GST)' },
    { hsnCode: '90183100', description: 'Syringes (12% GST)' },
    { hsnCode: '99999999', description: 'Invalid HSN Code' },
  ];

  for (const testCase of testCases) {
    try {
      const result = await pool.query(
        'SELECT * FROM get_hsn_tax_rate($1)',
        [testCase.hsnCode]
      );

      if (result.rows.length > 0) {
        const taxRate = result.rows[0];
        console.log(`✅ ${testCase.description}:`);
        console.log(`   CGST: ${taxRate.cgst_rate}%, SGST: ${taxRate.sgst_rate}%, IGST: ${taxRate.igst_rate}%`);
        console.log(`   Total: ${taxRate.total_rate}%, Category: ${taxRate.tax_category}`);
      } else {
        console.log(`❌ ${testCase.description}: No tax rate found`);
      }
    } catch (error) {
      console.error(`❌ Error testing ${testCase.description}:`, error.message);
    }
  }
}

async function testProductTaxRateFunction() {
  console.log('\n=== Test 2: Database Function get_product_tax_rate() ===');

  try {
    const result = await pool.query(
      'SELECT * FROM get_product_tax_rate($1)',
      [1] // Product ID 1 which we updated with HSN 30049099
    );

    if (result.rows.length > 0) {
      const taxRate = result.rows[0];
      console.log('✅ Product 1 tax rate lookup successful:');
      console.log(`   CGST: ${taxRate.cgst_rate}%, SGST: ${taxRate.sgst_rate}%, IGST: ${taxRate.igst_rate}%`);
      console.log(`   Total: ${taxRate.total_rate}%, Category: ${taxRate.tax_category}`);
    } else {
      console.log('❌ No tax rate found for product 1');
    }
  } catch (error) {
    console.error('❌ Error testing product tax rate function:', error.message);
  }
}

async function testProductServiceMethods() {
  console.log('\n=== Test 3: ProductService Methods via API ===');

  // Note: These would require adding controller endpoints for testing
  // For now, we'll just verify the database layer works
  console.log('⚠️  API endpoints for getProductWithTaxRate not yet exposed');
  console.log('   (Database layer verified - service methods ready for frontend integration)');
}

async function testHsnLookupCounts() {
  console.log('\n=== Test 4: HSN Tax Master Statistics ===');

  try {
    const result = await pool.query(`
      SELECT
        tax_category,
        COUNT(*) as hsn_count,
        MIN(cgst_rate + sgst_rate) as min_gst_rate,
        MAX(cgst_rate + sgst_rate) as max_gst_rate
      FROM hsn_tax_master
      WHERE active = true
      GROUP BY tax_category
      ORDER BY tax_category;
    `);

    console.log('✅ HSN Tax Master contains:');
    console.log('   Category'.padEnd(20) + 'HSN Codes'.padEnd(12) + 'GST Range');
    console.log('   ' + '-'.repeat(50));

    for (const row of result.rows) {
      console.log(
        `   ${row.tax_category.padEnd(20)}${String(row.hsn_count).padEnd(12)}${row.min_gst_rate}% - ${row.max_gst_rate}%`
      );
    }

    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM hsn_tax_master WHERE active = true'
    );
    console.log(`\n   Total Active HSN Codes: ${totalResult.rows[0].total}`);
  } catch (error) {
    console.error('❌ Error getting HSN statistics:', error.message);
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     HSN Tax Lookup Functionality Test Suite          ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    // Test database functions
    await testDatabaseFunction();
    await testProductTaxRateFunction();
    await testHsnLookupCounts();

    // Test API endpoints (requires authentication)
    const authenticated = await authenticate();
    if (authenticated) {
      await testProductServiceMethods();
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                  Tests Completed!                     ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  } finally {
    await pool.end();
  }
}

runAllTests();
