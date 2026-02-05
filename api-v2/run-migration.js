#!/usr/bin/env node
/**
 * Run a specific SQL migration on Railway database
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];
const MIGRATION_FILE = process.argv[3] || '../sql/migrations/006_add_security_columns.sql';

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is required');
  console.error('Usage: node run-migration.js <DATABASE_URL> [migration-file]');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL\n');

    const migrationPath = path.join(__dirname, MIGRATION_FILE);
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    const migrationName = path.basename(MIGRATION_FILE);

    console.log(`🔄 Running migration: ${migrationName}...\n`);

    await client.query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify columns were added
    console.log('🔍 Verifying new columns...');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'app_user'
      AND column_name IN (
        'password_changed_on',
        'password_history',
        'failed_login_attempts',
        'locked_until',
        'last_login_attempt'
      )
      ORDER BY column_name
    `);

    if (result.rows.length === 5) {
      console.log('✅ All 5 security columns added:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log(`⚠️  Found ${result.rows.length} of 5 expected columns`);
    }

    console.log('\n🎉 Database schema updated!');
    console.log('\n📋 Next step: Redeploy backend service in Railway\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(`   ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
