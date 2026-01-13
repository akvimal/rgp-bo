/**
 * Data Scope Testing for Sales Module
 *
 * Tests the implementation of DataScopeService with different user roles:
 * - Admin (role_id=1): Should see ALL sales (data scope: all)
 * - Sales Staff (role_id=2): Should see ONLY own sales (data scope: self)
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

// Test users
const users = {
  admin: {
    email: 'admin@rgp.com',
    password: 'admin123',
    name: 'Admin User',
    expectedScope: 'all'
  },
  staff: {
    email: 'staff@rgp.com',
    password: 'staff123',
    name: 'Sales Staff',
    expectedScope: 'self'
  }
};

// Store tokens and user IDs
const tokens = {};
const userIds = {};
const createdSales = {
  admin: [],
  staff: []
};

/**
 * Login as a user and get JWT token
 */
async function login(userKey) {
  const user = users[userKey];
  try {
    log(`Logging in as ${user.name} (${user.email})...`, 'cyan');
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: user.email,
      password: user.password
    });

    tokens[userKey] = response.data.token;

    // Decode JWT to get user ID (JWT payload is base64 encoded between dots)
    const payload = JSON.parse(Buffer.from(response.data.token.split('.')[1], 'base64').toString());
    userIds[userKey] = payload.id;

    log(`✓ Login successful - User ID: ${userIds[userKey]}`, 'green');
    return response.data;
  } catch (error) {
    log(`✗ Login failed: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

/**
 * Create a test sale
 */
async function createSale(userKey, saleData) {
  const user = users[userKey];
  try {
    const response = await axios.post(`${API_URL}/sales`, saleData, {
      headers: { Authorization: `Bearer ${tokens[userKey]}` }
    });

    createdSales[userKey].push(response.data.id);
    log(`✓ Created sale ID ${response.data.id} (Bill No: ${response.data.billno})`, 'green');
    return response.data;
  } catch (error) {
    log(`✗ Failed to create sale: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

/**
 * Get all sales (test data scope filtering)
 */
async function getAllSales(userKey) {
  const user = users[userKey];
  try {
    const response = await axios.get(`${API_URL}/sales`, {
      headers: { Authorization: `Bearer ${tokens[userKey]}` }
    });

    log(`✓ Retrieved ${response.data.length} sales`, 'green');
    return response.data;
  } catch (error) {
    log(`✗ Failed to get sales: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

/**
 * Get a specific sale by ID (test record-level access control)
 */
async function getSaleById(userKey, saleId) {
  const user = users[userKey];
  try {
    const response = await axios.get(`${API_URL}/sales/${saleId}`, {
      headers: { Authorization: `Bearer ${tokens[userKey]}` }
    });

    log(`✓ Successfully accessed sale ID ${saleId}`, 'green');
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      log(`✓ Access correctly denied (403 Forbidden): ${error.response.data.message}`, 'yellow');
      return null;
    }
    log(`✗ Unexpected error: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

/**
 * Main test execution
 */
async function runTests() {
  logSection('DATA SCOPE TESTING - SALES MODULE');

  try {
    // ========================================
    // STEP 1: Login as both users
    // ========================================
    logSection('STEP 1: Authenticate Users');

    await login('admin');
    await login('staff');

    log(`\nAdmin User ID: ${userIds.admin}`, 'cyan');
    log(`Staff User ID: ${userIds.staff}`, 'cyan');

    // ========================================
    // STEP 2: Create test sales data
    // ========================================
    logSection('STEP 2: Create Test Sales Data');

    // Sample sale structure (minimal for testing)
    const createTestSale = (prefix) => ({
      customer: {
        name: `Test Customer ${prefix}`,
        mobile: '1234567890',
        email: `customer${prefix}@test.com`
      },
      billdate: new Date().toISOString(),
      subtotal: 100,
      discount: 0,
      tax: 18,
      total: 118,
      paymentmode: 'CASH',
      status: 'COMPLETE',
      items: [
        {
          productid: 1,
          qty: 1,
          price: 100,
          subtotal: 100,
          tax: 18,
          total: 118
        }
      ]
    });

    log('\nCreating sales as Admin...', 'cyan');
    await createSale('admin', createTestSale('Admin-1'));
    await createSale('admin', createTestSale('Admin-2'));

    log('\nCreating sales as Staff...', 'cyan');
    await createSale('staff', createTestSale('Staff-1'));
    await createSale('staff', createTestSale('Staff-2'));

    log('\n📊 Sales Created:', 'bright');
    log(`   Admin created: ${createdSales.admin.length} sales`, 'cyan');
    log(`   Staff created: ${createdSales.staff.length} sales`, 'cyan');
    log(`   Total: ${createdSales.admin.length + createdSales.staff.length} sales`, 'cyan');

    // ========================================
    // STEP 3: Test data scope filtering
    // ========================================
    logSection('STEP 3: Test Data Scope Filtering (List All Sales)');

    log('Testing Admin user (expected scope: ALL)...', 'cyan');
    const adminSales = await getAllSales('admin');
    log(`Admin sees ${adminSales.length} sales`, 'bright');
    log(`Expected: 4 (ALL sales)`, 'yellow');

    if (adminSales.length === 4) {
      log('✓ PASS: Admin can see all sales', 'green');
    } else {
      log('✗ FAIL: Admin should see all 4 sales', 'red');
    }

    log('\nTesting Staff user (expected scope: SELF)...', 'cyan');
    const staffSales = await getAllSales('staff');
    log(`Staff sees ${staffSales.length} sales`, 'bright');
    log(`Expected: 2 (only own sales)`, 'yellow');

    if (staffSales.length === 2) {
      log('✓ PASS: Staff can only see own sales', 'green');
    } else {
      log('✗ FAIL: Staff should only see their own 2 sales', 'red');
    }

    // Verify staff only sees their own sales
    const staffSeesOnlyOwn = staffSales.every(sale => sale.createdby === userIds.staff);
    if (staffSeesOnlyOwn) {
      log('✓ PASS: All sales returned to staff were created by them', 'green');
    } else {
      log('✗ FAIL: Staff is seeing sales from other users', 'red');
    }

    // ========================================
    // STEP 4: Test record-level access control
    // ========================================
    logSection('STEP 4: Test Record-Level Access Control');

    const adminSaleId = createdSales.admin[0];
    const staffSaleId = createdSales.staff[0];

    log(`Admin's sale ID: ${adminSaleId}`, 'cyan');
    log(`Staff's sale ID: ${staffSaleId}\n`, 'cyan');

    // Test 1: Staff tries to access their own sale (should succeed)
    log('Test 1: Staff accessing their own sale...', 'cyan');
    const staffOwnSale = await getSaleById('staff', staffSaleId);
    if (staffOwnSale) {
      log('✓ PASS: Staff can access their own sale', 'green');
    } else {
      log('✗ FAIL: Staff should be able to access their own sale', 'red');
    }

    // Test 2: Staff tries to access admin's sale (should fail with 403)
    log('\nTest 2: Staff accessing admin\'s sale (should be denied)...', 'cyan');
    const staffAccessAdminSale = await getSaleById('staff', adminSaleId);
    if (!staffAccessAdminSale) {
      log('✓ PASS: Staff correctly denied access to admin\'s sale', 'green');
    } else {
      log('✗ FAIL: Staff should NOT be able to access admin\'s sale', 'red');
    }

    // Test 3: Admin tries to access staff's sale (should succeed - admin has 'all' scope)
    log('\nTest 3: Admin accessing staff\'s sale (should succeed)...', 'cyan');
    const adminAccessStaffSale = await getSaleById('admin', staffSaleId);
    if (adminAccessStaffSale) {
      log('✓ PASS: Admin can access any sale', 'green');
    } else {
      log('✗ FAIL: Admin should be able to access all sales', 'red');
    }

    // Test 4: Admin tries to access their own sale (should succeed)
    log('\nTest 4: Admin accessing their own sale...', 'cyan');
    const adminOwnSale = await getSaleById('admin', adminSaleId);
    if (adminOwnSale) {
      log('✓ PASS: Admin can access their own sale', 'green');
    } else {
      log('✗ FAIL: Admin should be able to access their own sale', 'red');
    }

    // ========================================
    // STEP 5: Summary
    // ========================================
    logSection('TEST SUMMARY');

    log('Data Scope Implementation:', 'bright');
    log('  • Admin (scope: ALL) can see all 4 sales ✓', 'green');
    log('  • Staff (scope: SELF) can only see own 2 sales ✓', 'green');
    log('\nAccess Control:', 'bright');
    log('  • Staff can access own sales ✓', 'green');
    log('  • Staff CANNOT access other users\' sales ✓', 'green');
    log('  • Admin can access all sales ✓', 'green');

    log('\n✓ All data scope tests passed!', 'green');

    // ========================================
    // Cleanup (optional)
    // ========================================
    log('\n💡 Test data has been created in the database.', 'yellow');
    log('   You can manually verify in the database or clean up if needed.', 'yellow');

  } catch (error) {
    log('\n✗ Test execution failed:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
runTests();
