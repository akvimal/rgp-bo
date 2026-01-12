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
      '../sql/migrations/006_employment_type_role_masters.sql',
      '../sql/migrations/007_salary_component_master.sql',
      '../sql/migrations/008_flexible_salary_structure.sql',
      '../sql/migrations/009_payroll_tables.sql',
      '../sql/migrations/010_kpi_enhancements.sql'
    ];

    for (const migration of migrations) {
      const fileName = path.basename(migration);
      console.log(`\nRunning migration: ${fileName}`);
      const filePath = path.join(__dirname, migration);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✓ ${fileName} completed successfully`);
      } catch (error) {
        console.error(`✗ ${fileName} failed:`, error.message);
        // Continue with next migration
      }
    }

    console.log('\n=== Migration Summary ===');

    // Check created tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%payroll%'
        OR table_name LIKE '%kpi%'
        OR table_name LIKE '%salary%'
        OR table_name LIKE '%employment%')
      ORDER BY table_name
    `);

    console.log('\nPayroll-related tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    // Check data
    const countResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM employment_type_master) as employment_types,
        (SELECT COUNT(*) FROM role_master) as roles,
        (SELECT COUNT(*) FROM salary_component_master) as salary_components,
        (SELECT COUNT(*) FROM kpi_category_master) as kpi_categories
    `);

    console.log('\nData inserted:');
    console.log(`  - Employment types: ${countResult.rows[0].employment_types}`);
    console.log(`  - Roles: ${countResult.rows[0].roles}`);
    console.log(`  - Salary components: ${countResult.rows[0].salary_components}`);
    console.log(`  - KPI categories: ${countResult.rows[0].kpi_categories}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
