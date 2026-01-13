@echo off
REM ==============================================================================
REM Database Migration Runner Script
REM ==============================================================================
REM Description: Run database migrations for RBAC, Payroll, and other features
REM Usage: run-migrations.bat
REM ==============================================================================

echo.
echo ========================================
echo   RGP Back Office - Database Migrations
echo ========================================
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

REM Check if database container is running
docker ps --filter "name=rgp-db" --format "{{.Names}}" | findstr rgp-db >nul
if errorlevel 1 (
    echo [ERROR] Database container 'rgp-db' is not running!
    echo Please start the database with: docker-compose up -d
    echo.
    pause
    exit /b 1
)

echo [OK] Docker and database container are running
echo.

REM Change to project root directory
cd /d "%~dp0"

echo ========================================
echo   Running RBAC Migrations
echo ========================================
echo.

echo [1/3] Running 012_feature_groups_access_levels.sql...
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql\migrations\012_feature_groups_access_levels.sql
if errorlevel 1 (
    echo [ERROR] Migration 012_feature_groups_access_levels.sql failed!
    pause
    exit /b 1
)
echo [OK] Migration 012 completed
echo.

echo [2/3] Running 013_complete_feature_group_access_levels.sql...
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql\migrations\013_complete_feature_group_access_levels.sql
if errorlevel 1 (
    echo [ERROR] Migration 013_complete_feature_group_access_levels.sql failed!
    pause
    exit /b 1
)
echo [OK] Migration 013 completed
echo.

echo [3/3] Running 035_multi_role_support.sql...
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql\migrations\035_multi_role_support.sql
if errorlevel 1 (
    echo [ERROR] Migration 035_multi_role_support.sql failed!
    pause
    exit /b 1
)
echo [OK] Migration 035 completed
echo.

echo ========================================
echo   All Migrations Completed Successfully!
echo ========================================
echo.
echo Summary:
echo   [OK] Feature Groups and Access Levels (012)
echo   [OK] Complete Feature Group Access Levels (013)
echo   [OK] Multi-Role Support (035)
echo.
echo Database is ready with:
echo   - RBAC system with feature groups
echo   - Granular access levels
echo   - Multi-role support for users
echo.
echo Next steps:
echo   1. Restart the API: docker-compose restart api
echo   2. Test RBAC features in the application
echo   3. Configure roles and permissions as needed
echo.

pause
