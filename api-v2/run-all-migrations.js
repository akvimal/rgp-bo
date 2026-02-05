#!/usr/bin/env node
/**
 * Run All Essential Migrations for Railway Deployment
 *
 * This script runs all migrations needed for core functionality:
 * - Authentication & Authorization
 * - RBAC & Feature Groups
 * - HR Management
 * - Audit & Monitoring
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is required');
  console.error('Usage: node run-all-migrations.js <DATABASE_URL>');
  process.exit(1);
}

// Essential migrations in dependency order
const MIGRATIONS = [
  // Core security enhancements
  { file: '006_add_security_columns.sql', name: 'Security columns (password management)', critical: true },
  { file: '007_create_audit_log.sql', name: 'Audit logging', critical: true },

  // Multi-role support
  { file: '035_multi_role_support.sql', name: 'Multi-role assignments', critical: true },

  // RBAC & Feature Groups
  { file: '012_feature_groups_access_levels.sql', name: 'Feature groups & access levels', critical: false },
  { file: '013_complete_feature_group_access_levels.sql', name: 'Complete feature group setup', critical: false },

  // HR Management
  { file: '003_hr_management_tables.sql', name: 'HR management tables', critical: false },

  // Additional features
  { file: '010_expiry_monitoring_audit_tables.sql', name: 'Expiry monitoring', critical: false },
  { file: '011_batch_movement_tracking.sql', name: 'Batch movement tracking', critical: false },
];

/**
 * Sanitize SQL for Railway deployment
 * - Remove GRANT statements (Railway handles permissions)
 * - Replace role names
 * - Handle other Railway-specific issues
 */
function sanitizeSqlForRailway(sql) {
  let sanitized = sql;

  // Remove GRANT statements
  sanitized = sanitized.replace(/GRANT\s+.*?;/gi, '-- GRANT removed for Railway');

  // Replace specific role references
  sanitized = sanitized.replace(/TO\s+rgpapp/gi, 'TO postgres');
  sanitized = sanitized.replace(/OWNER\s+TO\s+rgpapp/gi, 'OWNER TO postgres');

  // Replace schema authorization
  sanitized = sanitized.replace(/AUTHORIZATION\s+pg_database_owner/gi, 'AUTHORIZATION postgres');

  return sanitized;
}

async function runMigration(client, migrationFile, migrationName) {
  const migrationPath = path.join(__dirname, '../sql/migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.log(`   ⚠️  File not found: ${migrationFile}`);
    return { success: false, skipped: true };
  }

  try {
    let sql = fs.readFileSync(migrationPath, 'utf8');

    // Sanitize SQL for Railway
    sql = sanitizeSqlForRailway(sql);

    // Execute migration
    await client.query(sql);

    console.log(`   ✅ ${migrationName}`);
    return { success: true, skipped: false };

  } catch (error) {
    const errorMsg = error.message;

    // Check if error is due to objects already existing
    if (errorMsg.includes('already exists') ||
        errorMsg.includes('duplicate key') ||
        errorMsg.includes('already has a role')) {
      console.log(`   ⚠️  ${migrationName} (already applied)`);
      return { success: true, skipped: false, alreadyExists: true };
    }

    // Log error but continue
    console.log(`   ❌ ${migrationName}`);
    console.log(`      Error: ${errorMsg.split('\n')[0]}`);
    return { success: false, skipped: false, error: errorMsg };
  }
}

async function runAllMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  let stats = {
    total: MIGRATIONS.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    alreadyApplied: 0
  };

  try {
    console.log('\n🚀 Railway Migration Runner');
    console.log('='.repeat(50));
    console.log(`Database: ${DATABASE_URL.split('@')[1]}\n`);

    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL\n');

    console.log('📝 Running migrations...\n');

    // Run each migration
    for (const migration of MIGRATIONS) {
      const result = await runMigration(client, migration.file, migration.name);

      if (result.skipped) {
        stats.skipped++;
      } else if (result.alreadyExists) {
        stats.alreadyApplied++;
        stats.successful++;
      } else if (result.success) {
        stats.successful++;
      } else {
        stats.failed++;

        // Stop on critical migration failures
        if (migration.critical && !result.alreadyExists) {
          console.log('\n⛔ Critical migration failed! Stopping...\n');
          break;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   Total migrations: ${stats.total}`);
    console.log(`   ✅ Successful: ${stats.successful}`);
    console.log(`   ⚠️  Already applied: ${stats.alreadyApplied}`);
    console.log(`   ⏭️  Skipped: ${stats.skipped}`);
    console.log(`   ❌ Failed: ${stats.failed}`);

    // Verify critical tables
    console.log('\n🔍 Verifying critical tables...');
    const criticalTables = [
      'app_user',
      'app_role',
      'audit_log',
      'user_role_assignment'
    ];

    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ANY($1)
    `, [criticalTables]);

    const existingCritical = tableCheck.rows.map(r => r.table_name);
    const missingCritical = criticalTables.filter(t => !existingCritical.includes(t));

    if (missingCritical.length === 0) {
      console.log('✅ All critical tables exist!');
      console.log('\n🎉 Database is ready for deployment!\n');
      console.log('📋 Next steps:');
      console.log('   1. Restart backend service in Railway');
      console.log('   2. Test login at frontend URL');
      console.log('   3. Login: admin@rgp.com / admin123\n');
    } else {
      console.log('❌ Missing critical tables:');
      missingCritical.forEach(t => console.log(`   - ${t}`));
      console.log('\n⚠️  Database may not be fully functional.\n');
    }

  } catch (error) {
    console.error('\n💥 Fatal error:');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
runAllMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
