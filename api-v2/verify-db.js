#!/usr/bin/env node
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('Usage: node verify-db.js <DATABASE_URL>');
  process.exit(1);
}

async function verify() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL\n');

    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 10
    `);
    console.log(`📊 Found ${tablesResult.rowCount} tables (showing first 10):`);
    tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));

    // Check admin user
    console.log('\n🔍 Checking admin user...');
    const userResult = await client.query(
      "SELECT id, email, full_name, active FROM app_user WHERE email = 'admin@rgp.com'"
    );

    if (userResult.rows.length > 0) {
      console.log('✅ Admin user found:');
      console.log(`   ID: ${userResult.rows[0].id}`);
      console.log(`   Email: ${userResult.rows[0].email}`);
      console.log(`   Name: ${userResult.rows[0].full_name}`);
      console.log(`   Active: ${userResult.rows[0].active}`);
    } else {
      console.log('❌ Admin user NOT found');
      console.log('Checking all users...');
      const allUsers = await client.query("SELECT email FROM app_user LIMIT 5");
      if (allUsers.rows.length > 0) {
        console.log('Found these users:');
        allUsers.rows.forEach(row => console.log(`   - ${row.email}`));
      } else {
        console.log('No users found in database');
      }
    }

    // Check roles
    console.log('\n📋 Checking roles...');
    const rolesResult = await client.query("SELECT id, name FROM app_role ORDER BY id");
    if (rolesResult.rows.length > 0) {
      console.log(`✅ Found ${rolesResult.rowCount} roles:`);
      rolesResult.rows.forEach(row => console.log(`   - ${row.id}: ${row.name}`));
    } else {
      console.log('❌ No roles found');
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

verify();
