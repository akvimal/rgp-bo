const axios = require('axios');

async function test() {
  try {
    console.log('Testing login...');
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      email: 'admin@rgp.com',
      password: 'admin123'
    });
    console.log('✓ Login successful');
    console.log('  Response:', JSON.stringify(loginRes.data, null, 2));

    const token = loginRes.data.access_token || loginRes.data.token;

    console.log('\nTesting GET /purchases with token...');
    const invoiceRes = await axios.get('http://localhost:3000/purchases', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✓ Invoice fetch successful');
    console.log('  Count:', invoiceRes.data.length);

    console.log('\nTesting POST /purchases with token...');
    const createRes = await axios.post('http://localhost:3000/purchases', {
      vendorid: 1,
      invoiceno: `TEST-${Date.now()}`,
      invoicedate: '2025-12-05',
      total: 1000.00
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✓ Invoice create successful');
    console.log('  Invoice ID:', createRes.data.id);

  } catch (error) {
    console.error('✗ Error:', error.response?.status, error.response?.data || error.message);
    if (error.response) {
      console.error('  Headers sent:', JSON.stringify(error.config.headers, null, 2));
    }
  }
}

test();
