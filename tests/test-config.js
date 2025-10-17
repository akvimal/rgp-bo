/**
 * Test Configuration
 *
 * Update the database credentials below to match your local PostgreSQL setup.
 * The default values are from api-v2/.env file.
 */

module.exports = {
    // Option 1: Use connection string (recommended)
    connectionString: process.env.DATABASE_URL || 'postgresql://rgpapp:r9pAdmin7@localhost:5432/rgpdb',

    // Option 2: Use individual parameters (alternative)
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'rgpdb',
    user: process.env.DB_USER || 'rgpapp',
    password: process.env.DB_PASSWORD || 'r9pAdmin7',

    // Connection pool settings
    max: 10,
    ssl: false,

    // Timeout settings
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
};
