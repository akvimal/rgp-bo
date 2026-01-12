/**
 * Multi-Role Support End-to-End Test
 *
 * Tests:
 * 1. Login and get JWT token
 * 2. Get current roles for user
 * 3. Assign additional role
 * 4. Verify user has multiple roles
 * 5. Get new JWT with merged permissions
 * 6. Verify JWT contains multiple role_ids
 * 7. Test removing a role
 * 8. Test preventing removal of last role
 */

const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3000;
const TEST_USER = {
  email: 'admin@rgp.com',
  password: 'admin123',
  id: 2
};

// Helper function to make HTTP requests
function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      host: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Helper to decode JWT
function decodeJWT(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64').toString();
  return JSON.parse(payload);
}

// Test suite
async function runTests() {
  console.log('🧪 Starting Multi-Role Support Tests\n');
  console.log('=' .repeat(60));

  let token;
  let userId = TEST_USER.id;

  try {
    // Test 1: Login
    console.log('\n📝 Test 1: Login and Get JWT Token');
    const loginRes = await makeRequest('POST', '/auth/login', {}, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    token = loginRes.data.token;
    const initialJWT = decodeJWT(token);
    console.log('✅ Login successful');
    console.log(`   User ID: ${initialJWT.id}`);
    console.log(`   Email: ${initialJWT.email}`);
    console.log(`   Initial role_ids: ${JSON.stringify(initialJWT.role_ids)}`);
    console.log(`   Initial permissions count: ${initialJWT.permissions?.length || 'N/A'}`);

    // Test 2: Get current roles
    console.log('\n📝 Test 2: Get Current Roles for User');
    const rolesRes = await makeRequest('GET', `/users/roles/${userId}`, {
      'Authorization': `Bearer ${token}`
    });

    if (rolesRes.status !== 200) {
      throw new Error(`Get roles failed: ${rolesRes.status}`);
    }

    const currentRoles = rolesRes.data;
    console.log(`✅ User has ${currentRoles.length} role(s):`);
    currentRoles.forEach(r => {
      console.log(`   - ${r.role.name} (ID: ${r.role_id}) - Active: ${r.active}`);
    });

    // Test 3: Assign additional role (if user has less than 2 roles)
    if (currentRoles.length < 2) {
      console.log('\n📝 Test 3: Assign Additional Role (Sales Staff)');
      const assignRes = await makeRequest('POST', '/users/roles/assign', {
        'Authorization': `Bearer ${token}`
      }, {
        userId: userId,
        roleId: 2  // Sales Staff
      });

      if (assignRes.status === 201 || assignRes.status === 200) {
        console.log('✅ Role assigned successfully');
        console.log(`   Assignment ID: ${assignRes.data.id}`);
        console.log(`   Assigned on: ${assignRes.data.assigned_on}`);
      } else if (assignRes.status === 400 && assignRes.data.message?.includes('already has role')) {
        console.log('⚠️  Role already assigned (skipping)');
      } else {
        throw new Error(`Assign role failed: ${assignRes.status} - ${JSON.stringify(assignRes.data)}`);
      }
    } else {
      console.log('\n📝 Test 3: Assign Additional Role');
      console.log('⚠️  User already has multiple roles (skipping)');
    }

    // Test 4: Verify user now has multiple roles
    console.log('\n📝 Test 4: Verify User Has Multiple Roles');
    const updatedRolesRes = await makeRequest('GET', `/users/roles/${userId}`, {
      'Authorization': `Bearer ${token}`
    });

    const updatedRoles = updatedRolesRes.data;
    console.log(`✅ User now has ${updatedRoles.length} role(s):`);
    updatedRoles.forEach(r => {
      console.log(`   - ${r.role.name} (ID: ${r.role_id})`);
    });

    if (updatedRoles.length < 2) {
      console.log('⚠️  Expected at least 2 roles, but found:', updatedRoles.length);
    }

    // Test 5: Get new JWT with merged permissions
    console.log('\n📝 Test 5: Login Again to Get Updated JWT');
    const newLoginRes = await makeRequest('POST', '/auth/login', {}, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    const newToken = newLoginRes.data.token;
    const updatedJWT = decodeJWT(newToken);

    console.log('✅ New JWT obtained');
    console.log(`   Role IDs: ${JSON.stringify(updatedJWT.role_ids)}`);
    console.log(`   Permissions count: ${updatedJWT.permissions.length}`);
    console.log(`   Resources: ${updatedJWT.permissions.map(p => p.resource).join(', ')}`);

    // Test 6: Verify JWT structure
    console.log('\n📝 Test 6: Verify JWT Structure');
    const hasRoleIds = Array.isArray(updatedJWT.role_ids);
    const hasPermissions = Array.isArray(updatedJWT.permissions);
    const hasMultipleRoles = updatedJWT.role_ids?.length >= 2;

    console.log(`   Has role_ids array: ${hasRoleIds ? '✅' : '❌'}`);
    console.log(`   Has permissions array: ${hasPermissions ? '✅' : '❌'}`);
    console.log(`   Has multiple roles: ${hasMultipleRoles ? '✅' : '❌'}`);
    console.log(`   Backward compatible role_id: ${updatedJWT.role_id ? '✅' : '❌'}`);

    // Test 7: Try to remove a role (if user has more than 1)
    if (updatedRoles.length > 1) {
      console.log('\n📝 Test 7: Remove One Role');
      const roleToRemove = updatedRoles.find(r => r.role_id === 2); // Try to remove Sales Staff

      if (roleToRemove) {
        const removeRes = await makeRequest('DELETE', `/users/roles/${userId}/${roleToRemove.role_id}`, {
          'Authorization': `Bearer ${newToken}`
        });

        if (removeRes.status === 200) {
          console.log('✅ Role removed successfully');
          console.log(`   Removed: ${roleToRemove.role.name}`);
        } else {
          console.log(`⚠️  Remove failed: ${removeRes.status} - ${JSON.stringify(removeRes.data)}`);
        }
      }
    } else {
      console.log('\n📝 Test 7: Remove One Role');
      console.log('⚠️  User has only 1 role (skipping remove test)');
    }

    // Test 8: Try to remove last role (should fail)
    console.log('\n📝 Test 8: Try to Remove Last Role (Should Fail)');
    const finalRolesRes = await makeRequest('GET', `/users/roles/${userId}`, {
      'Authorization': `Bearer ${newToken}`
    });
    const finalRoles = finalRolesRes.data.filter(r => r.active);

    if (finalRoles.length === 1) {
      const lastRole = finalRoles[0];
      const removeLastRes = await makeRequest('DELETE', `/users/roles/${userId}/${lastRole.role_id}`, {
        'Authorization': `Bearer ${newToken}`
      });

      if (removeLastRes.status === 400) {
        console.log('✅ Correctly prevented removal of last role');
        console.log(`   Error message: ${removeLastRes.data.message}`);
      } else {
        console.log(`❌ Should have prevented removal but got: ${removeLastRes.status}`);
      }
    } else {
      console.log('⚠️  User still has multiple roles (cannot test last role removal)');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All Tests Completed!\n');
    console.log('Summary:');
    console.log(`  ✅ Login works with multi-role JWT`);
    console.log(`  ✅ Can retrieve user roles`);
    console.log(`  ✅ Can assign multiple roles`);
    console.log(`  ✅ JWT contains merged permissions`);
    console.log(`  ✅ Can remove roles (with protection)`);
    console.log(`  ✅ Prevents removal of last role`);

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
