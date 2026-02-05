#!/usr/bin/env node
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

async function checkSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'app_user'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 app_user table columns:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
