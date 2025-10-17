/**
 * Database Authentication Diagnostic Tool
 *
 * This script attempts various connection methods to identify the working configuration.
 */

const { Pool } = require('pg');

// Different connection configurations to try
const connectionConfigs = [
    {
        name: 'Connection String (from .env)',
        config: {
            connectionString: 'postgresql://rgpapp:r9pAdmin7@localhost:5432/rgpdb',
            ssl: false
        }
    },
    {
        name: 'Individual Parameters (from .env)',
        config: {
            host: 'localhost',
            port: 5432,
            database: 'rgpdb',
            user: 'rgpapp',
            password: 'r9pAdmin7',
            ssl: false
        }
    },
    {
        name: 'Connection String (URL encoded password)',
        config: {
            connectionString: 'postgresql://rgpapp:r9pAdmin7@localhost:5432/rgpdb',
            ssl: { rejectUnauthorized: false }
        }
    },
    {
        name: 'Default postgres user (no password)',
        config: {
            host: 'localhost',
            port: 5432,
            database: 'rgpdb',
            user: 'postgres',
            ssl: false
        }
    },
    {
        name: 'Trust authentication',
        config: {
            host: 'localhost',
            port: 5432,
            database: 'rgpdb',
            user: 'rgpapp',
            ssl: false
            // No password - relies on trust auth
        }
    }
];

async function testConnection(name, config) {
    const pool = new Pool({
        ...config,
        connectionTimeoutMillis: 3000
    });

    try {
        const result = await pool.query('SELECT current_user, current_database()');
        console.log(`\n✅ SUCCESS: ${name}`);
        console.log(`   User: ${result.rows[0].current_user}`);
        console.log(`   Database: ${result.rows[0].current_database}`);
        console.log(`   Config used:`, JSON.stringify(config, null, 2));
        await pool.end();
        return true;
    } catch (error) {
        console.log(`\n❌ FAILED: ${name}`);
        console.log(`   Error: ${error.message} (${error.code || 'N/A'})`);
        await pool.end();
        return false;
    }
}

async function runDiagnostics() {
    console.log('='.repeat(70));
    console.log('PostgreSQL Authentication Diagnostics');
    console.log('='.repeat(70));
    console.log('\nTrying different connection methods...\n');

    let successCount = 0;
    let workingConfig = null;

    for (const { name, config } of connectionConfigs) {
        const success = await testConnection(name, config);
        if (success && !workingConfig) {
            workingConfig = config;
            successCount++;
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('Diagnostic Results');
    console.log('='.repeat(70));

    if (successCount > 0) {
        console.log(`\n✅ Found ${successCount} working configuration(s)!`);
        console.log('\nRecommended Action:');
        console.log('Update tests/test-config.js with this configuration:');
        console.log('\nmodule.exports = {');
        if (workingConfig.connectionString) {
            console.log(`    connectionString: '${workingConfig.connectionString}',`);
        } else {
            console.log(`    host: '${workingConfig.host}',`);
            console.log(`    port: ${workingConfig.port},`);
            console.log(`    database: '${workingConfig.database}',`);
            console.log(`    user: '${workingConfig.user}',`);
            if (workingConfig.password) {
                console.log(`    password: '${workingConfig.password}',`);
            }
        }
        console.log(`    ssl: ${workingConfig.ssl},`);
        console.log(`    max: 10,`);
        console.log(`    connectionTimeoutMillis: 5000,`);
        console.log(`    idleTimeoutMillis: 30000,`);
        console.log('};');
    } else {
        console.log('\n❌ No working configurations found!');
        console.log('\nPossible causes:');
        console.log('1. PostgreSQL is not running');
        console.log('2. Database "rgpdb" does not exist');
        console.log('3. User "rgpapp" does not exist');
        console.log('4. pg_hba.conf does not allow connections from localhost');
        console.log('\nNext steps:');
        console.log('1. Check if PostgreSQL is running: netstat -an | findstr ":5432"');
        console.log('2. Check API logs - if API connects, note the credentials');
        console.log('3. Review PostgreSQL logs for authentication errors');
        console.log('4. Check pg_hba.conf authentication method');
    }

    console.log('='.repeat(70));
}

// Run diagnostics
runDiagnostics().catch(console.error);
