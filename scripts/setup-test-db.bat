@echo off
REM Test Database Setup Script for RGP Back Office
REM Creates and initializes the test database

setlocal

set CONTAINER_NAME=rgp-postgres
set DB_NAME=rgpdb
set TEST_DB_NAME=rgpdb_test
set DB_USER=rgpapp
set SQL_DIR=sql

echo ========================================
echo RGP Test Database Setup
echo ========================================
echo Container: %CONTAINER_NAME%
echo Source DB: %DB_NAME%
echo Test DB: %TEST_DB_NAME%
echo ========================================

REM Drop existing test database if it exists
echo.
echo Dropping existing test database (if any)...
docker exec %CONTAINER_NAME% psql -U postgres -c "DROP DATABASE IF EXISTS %TEST_DB_NAME%;"

REM Create test database
echo Creating test database...
docker exec %CONTAINER_NAME% psql -U postgres -c "CREATE DATABASE %TEST_DB_NAME% OWNER %DB_USER%;"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create test database!
    exit /b 1
)

REM Copy schema from main database
echo Copying schema from main database...
docker exec %CONTAINER_NAME% pg_dump -U %DB_USER% -s %DB_NAME% | docker exec -i %CONTAINER_NAME% psql -U %DB_USER% %TEST_DB_NAME%

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to copy schema!
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS: Test database created!
echo ========================================
echo.
echo Next steps:
echo 1. Update .env.test with test database credentials
echo 2. Run tests with: npm run test
echo.
echo Test database: %TEST_DB_NAME%
echo ========================================

endlocal
