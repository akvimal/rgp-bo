@echo off
REM RGP Back Office - Railway Deployment Setup Script (Windows)
REM This script helps initialize the database on Railway

echo.
echo 🚀 RGP Back Office - Railway Setup
echo ==================================
echo.

REM Check if DATABASE_URL is set
if "%DATABASE_URL%"=="" (
    echo ❌ ERROR: DATABASE_URL environment variable is not set
    echo Please set it using: set DATABASE_URL=your-railway-postgres-url
    exit /b 1
)

echo ✅ DATABASE_URL is set
echo.

echo 📊 Initializing database schema...
echo.

REM Run DDL scripts
echo 1️⃣ Creating tables...
psql "%DATABASE_URL%" -f sql/ddl/tables.sql
if errorlevel 1 (
    echo ❌ Failed to create tables
    exit /b 1
)
echo ✅ Tables created

echo 2️⃣ Creating sequences...
psql "%DATABASE_URL%" -f sql/ddl/sequences.sql
if errorlevel 1 (
    echo ❌ Failed to create sequences
    exit /b 1
)
echo ✅ Sequences created

echo 3️⃣ Creating functions...
psql "%DATABASE_URL%" -f sql/ddl/functions.sql
if errorlevel 1 (
    echo ❌ Failed to create functions
    exit /b 1
)
echo ✅ Functions created

echo 4️⃣ Creating views...
psql "%DATABASE_URL%" -f sql/ddl/views.sql
if errorlevel 1 (
    echo ❌ Failed to create views
    exit /b 1
)
echo ✅ Views created

echo.
echo 📝 Initializing data...
psql "%DATABASE_URL%" -f sql/init.sql
if errorlevel 1 (
    echo ❌ Failed to initialize data
    exit /b 1
)
echo ✅ Initial data loaded (admin user, roles)

echo.
echo 🔄 Running migrations...

REM Run migrations in order
for %%f in (sql\migrations\*.sql) do (
    echo    Running: %%~nxf
    psql "%DATABASE_URL%" -f "%%f"
)

echo ✅ Migrations completed
echo.
echo 🎉 Database setup complete!
echo.
echo 📋 Next steps:
echo    1. Test login with: admin@rgp.com / admin123
echo    2. Change default credentials
echo    3. Configure file upload storage (Railway volumes or cloud)
echo.
