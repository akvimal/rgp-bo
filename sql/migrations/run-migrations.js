const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'rgpapp',
  password: 'r9pAdmin7',
  database: 'rgpdb'
});

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to database');

    const migrations = [
      '006_employment_type_role_masters.sql',
      '007_salary_component_master.sql',
      '008_flexible_salary_structure.sql',
      '009_payroll_tables.sql',
      '010_kpi_enhancements.sql'
    ];

    for (const migration of migrations) {
      console.log(`\nRunning migration: ${migration}`);
      const filePath = path.join(__dirname, migration);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✓ ${migration} completed successfully`);
      } catch (error) {
        console.error(`✗ ${migration} failed:`, error.message);
        // Continue with next migration
      }
    }

    console.log('\n=== Migration Summary ===');

    // Check created tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%payroll%'
        OR table_name LIKE '%kpi%'
        OR table_name LIKE '%salary%'
        OR table_name LIKE '%employment%'
      ORDER BY table_name
    `);

    console.log('\nPayroll-related tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
