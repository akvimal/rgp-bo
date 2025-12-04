-- Setup Test Database
-- This script creates a test database for running unit and integration tests

-- Create test database (run as postgres superuser)
CREATE DATABASE rgpdb_test
    WITH
    OWNER = rgpapp
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.utf8'
    LC_CTYPE = 'en_US.utf8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE rgpdb_test TO rgpapp;

-- Connect to test database
\c rgpdb_test

-- Copy schema from main database
-- You can run: pg_dump -s rgpdb | psql rgpdb_test
-- Or use the migration scripts

COMMENT ON DATABASE rgpdb_test IS 'Test database for RGP Back Office - DO NOT use in production';
