#!/usr/bin/env node
/**
 * Railway Database Setup Script
 * Initializes Railway PostgreSQL database with schema and data
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database URL from environment or command line
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is required');
  console.error('Usage: node railway-db-setup.js <DATABASE_URL>');
  console.error('   OR: DATABASE_URL=<url> node railway-db-setup.js');
  process.exit(1);
}

// SQL files to execute in order
// Paths are relative to project root
const SQL_FILES = [
  // DDL files
  { path: '../sql/ddl/tables.sql', name: 'Tables' },
  { path: '../sql/ddl/sequences.sql', name: 'Sequences' },
  { path: '../sql/ddl/functions.sql', name: 'Functions' },
  { path: '../sql/ddl/views.sql', name: 'Views' },

  // Initial data
  { path: '../sql/init.sql', name: 'Initial data (admin user, roles)' },

  // Migrations
  { path: '../sql/migrations/002_fix_bill_number_race_condition.sql', name: 'Migration: Bill number race condition fix' },
  { path: '../sql/migrations/003_hr_management_tables.sql', name: 'Migration: HR management tables' },
  { path: '../sql/migrations/004_setup_test_db.sql', name: 'Migration: Test database setup' },
  { path: '../sql/migrations/005_update_hr_permissions.sql', name: 'Migration: HR permissions update' },
];

async function executeSqlFile(client, filePath, fileName) {
  try {
    const fullPath = path.join(__dirname, filePath);

    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Skipping: ${fileName} (file not found: ${filePath})`);
      return false;
    }

    const sql = fs.readFileSync(fullPath, 'utf8');

    console.log(`   Executing: ${fileName}...`);
    await client.query(sql);
    console.log(`   ✅ ${fileName} completed`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error in ${fileName}:`);
    console.error(`      ${error.message}`);

    // Don't fail on duplicate/already exists errors
    if (error.message.includes('already exists') ||
        error.message.includes('duplicate key')) {
      console.log(`   ⚠️  Skipping duplicate objects`);
      return true;
    }

    throw error;
  }
}

async function setupDatabase() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Railway uses self-signed certs
    }
  });

  try {
    console.log('\n🚀 RGP Back Office - Railway Database Setup');
    console.log('==========================================\n');

    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL\n');

    // Test connection
    const versionResult = await client.query('SELECT version()');
    console.log(`📊 PostgreSQL Version: ${versionResult.rows[0].version.split(',')[0]}\n`);

    console.log('📝 Initializing database schema...\n');

    let successCount = 0;
    let skipCount = 0;

    for (const file of SQL_FILES) {
      const success = await executeSqlFile(client, file.path, file.name);
      if (success) {
        successCount++;
      } else {
        skipCount++;
      }
    }

    console.log('\n✅ Database setup completed!');
    console.log(`   - ${successCount} files executed successfully`);
    if (skipCount > 0) {
      console.log(`   - ${skipCount} files skipped (not found)`);
    }

    // Verify admin user
    console.log('\n🔍 Verifying setup...');
    const adminResult = await client.query(
      "SELECT email, full_name FROM app_user WHERE email = 'admin@rgp.com'"
    );

    if (adminResult.rows.length > 0) {
      console.log('✅ Admin user verified:');
      console.log(`   Email: ${adminResult.rows[0].email}`);
      console.log(`   Name: ${adminResult.rows[0].full_name}`);
    } else {
      console.warn('⚠️  Admin user not found - check init.sql execution');
    }

    console.log('\n🎉 Railway database is ready!');
    console.log('\n📋 Next steps:');
    console.log('   1. Deploy backend service to Railway');
    console.log('   2. Deploy frontend service to Railway');
    console.log('   3. Configure CORS_ORIGINS environment variable');
    console.log('   4. Test login with: admin@rgp.com / admin123');
    console.log('   5. IMPORTANT: Change default admin password!\n');

  } catch (error) {
    console.error('\n❌ Setup failed:');
    console.error(`   ${error.message}`);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('📡 Database connection closed\n');
  }
}

// Run setup
setupDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
