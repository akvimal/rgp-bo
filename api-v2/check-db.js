const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'rgpapp',
  password: 'r9pAdmin7',
  database: 'rgpdb'
});

async function checkDB() {
  try {
    await client.connect();

    // Check if store table exists
    const storeCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'store'
      );
    `);

    console.log('Store table exists:', storeCheck.rows[0].exists);

    // Check if app_user table exists and get sample users
    const users = await client.query(`
      SELECT id, email, full_name FROM app_user ORDER BY id LIMIT 5
    `);

    console.log('\nSample users:');
    users.rows.forEach(u => console.log(`  ID: ${u.id}, Email: ${u.email}, Name: ${u.full_name}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDB();
