#!/usr/bin/env node
/**
 * Check for missing tables in Railway database
 * Compares TypeORM entities with actual database tables
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('Usage: node check-missing-tables.js <DATABASE_URL>');
  process.exit(1);
}

// List of expected tables from entities
const EXPECTED_TABLES = [
  'app_user',
  'app_role',
  'audit_log',
  'user_role_assignment',
  'role_feature_assignment',
  'role_sub_feature_assignment',
  'feature_group',
  'sub_feature',
  'business',
  'business_location',
  'store',
  'store_cash_account',
  'product',
  'product_price2',
  'customer',
  'vendor',
  'sale',
  'sale_item',
  'purchase_invoice',
  'purchase_invoice_item',
  'shift',
  'user_shift',
  'attendance',
  'leave_type',
  'leave_request',
  'leave_balance',
  'user_score',
  'hr_audit_log',
  'bug_report',
  'batch_movement_log',
  'expiry_alert_log'
];

async function checkMissingTables() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL\n');

    // Get all existing tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const existingTables = result.rows.map(r => r.table_name);
    const missingTables = EXPECTED_TABLES.filter(t => !existingTables.includes(t));

    console.log(`📊 Database Status:`);
    console.log(`   - Existing tables: ${existingTables.length}`);
    console.log(`   - Expected tables: ${EXPECTED_TABLES.length}`);
    console.log(`   - Missing tables: ${missingTables.length}\n`);

    if (missingTables.length > 0) {
      console.log('❌ Missing tables:');
      missingTables.forEach(t => console.log(`   - ${t}`));
    } else {
      console.log('✅ All expected tables exist!');
    }

    console.log('\n📋 Existing tables:');
    existingTables.forEach(t => console.log(`   - ${t}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMissingTables();
