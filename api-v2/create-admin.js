#!/usr/bin/env node
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('Usage: node create-admin.js <DATABASE_URL>');
  process.exit(1);
}

async function createAdmin() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL\n');

    // Hash the password
    const password = 'admin123';
    const hashedPassword = bcrypt.hashSync(password, 10);

    console.log('👤 Creating admin user...');

    // Create admin user
    const result = await client.query(`
      INSERT INTO app_user (
        email, password, full_name,
        role_id, active, archive, created_on, updated_on
      ) VALUES (
        'admin@rgp.com',
        $1,
        'System Administrator',
        1,
        true,
        false,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        password = $1,
        full_name = 'System Administrator',
        role_id = 1,
        active = true,
        archive = false,
        updated_on = NOW()
      RETURNING id, email, full_name
    `, [hashedPassword]);

    console.log('✅ Admin user created/updated:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Name: ${result.rows[0].full_name}`);
    console.log(`   Password: ${password}`);

    console.log('\n🎉 Admin user is ready!');
    console.log('\n📋 Login credentials:');
    console.log(`   Email: admin@rgp.com`);
    console.log(`   Password: admin123`);
    console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

createAdmin();
