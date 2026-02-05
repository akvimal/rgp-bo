#!/usr/bin/env node
/**
 * Fix Admin Role Permissions - Add Missing Sales Features
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('Usage: node fix-admin-permissions.js <DATABASE_URL>');
  process.exit(1);
}

async function fixAdminPermissions() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway PostgreSQL\n');

    // Get current admin permissions
    const currentRole = await client.query('SELECT permissions FROM app_role WHERE id = 1');
    const permissions = currentRole.rows[0].permissions;

    console.log('📝 Updating admin role permissions...\n');

    // Find and update sales permissions
    const salesPermIndex = permissions.findIndex(p => p.resource === 'sales');

    if (salesPermIndex !== -1) {
      // Add missing sales paths
      permissions[salesPermIndex].path = [
        "/secure/sales/pos",
        "/secure/sales/pos/new",
        "/secure/sales/list",
        "/secure/sales/view",
        "/secure/sales/new",
        "/secure/sales/edit",
        "/secure/sales/returns",
        "/secure/sales/reminders",
        "/secure/sales/intent",        // ← ADD THIS
        "/secure/sales/deliveries"     // ← ADD THIS
      ];

      // Ensure comprehensive policies
      permissions[salesPermIndex].policies = [
        {
          "action": "read",
          "properties": []
        },
        {
          "action": "view",
          "properties": []
        },
        {
          "action": "add",
          "path": "/new",
          "properties": []
        },
        {
          "action": "edit",
          "path": "/edit",
          "properties": []
        },
        {
          "action": "delete",
          "properties": []
        },
        {
          "action": "bill",
          "path": "/bill/print"
        },
        {
          "action": "intent",           // ← ADD THIS
          "properties": []
        },
        {
          "action": "deliveries",       // ← ADD THIS
          "properties": []
        }
      ];

      console.log('✅ Updated sales permissions to include:');
      console.log('   - /secure/sales/intent');
      console.log('   - /secure/sales/deliveries\n');
    }

    // Update the role in database
    await client.query(
      'UPDATE app_role SET permissions = $1, updated_on = NOW() WHERE id = 1',
      [JSON.stringify(permissions)]
    );

    console.log('✅ Admin role permissions updated successfully!\n');

    // Verify
    const updated = await client.query('SELECT name, permissions FROM app_role WHERE id = 1');
    const salesPerm = updated.rows[0].permissions.find(p => p.resource === 'sales');

    console.log('📋 Sales paths now include:');
    salesPerm.path.forEach(p => console.log(`   - ${p}`));

    console.log('\n🎉 Admin user now has full access to all sales features!');
    console.log('\n📋 Next step: Logout and login again to refresh permissions\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixAdminPermissions();
