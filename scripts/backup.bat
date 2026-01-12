@echo off
REM Database Backup Script for RGP Back Office
REM Creates a timestamped backup of the PostgreSQL database

setlocal

REM Configuration
set BACKUP_DIR=backups
set CONTAINER_NAME=rgp-postgres
set DB_NAME=rgpdb
set DB_USER=rgpapp
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

REM Create backup directory if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo ========================================
echo RGP Database Backup Script
echo ========================================
echo Backup Directory: %BACKUP_DIR%
echo Container: %CONTAINER_NAME%
echo Database: %DB_NAME%
echo Timestamp: %TIMESTAMP%
echo ========================================

REM Create backup
echo Creating backup...
docker exec %CONTAINER_NAME% pg_dump -U %DB_USER% %DB_NAME% > %BACKUP_DIR%\backup_%TIMESTAMP%.sql

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Backup created at %BACKUP_DIR%\backup_%TIMESTAMP%.sql

    REM Get file size
    for %%A in (%BACKUP_DIR%\backup_%TIMESTAMP%.sql) do set SIZE=%%~zA
    echo Backup size: %SIZE% bytes

    REM Count backup files
    dir /b %BACKUP_DIR%\backup_*.sql 2>nul | find /c /v "" > temp.txt
    set /p COUNT=<temp.txt
    del temp.txt
    echo Total backups: %COUNT%
) else (
    echo ERROR: Backup failed!
    echo.
    echo Troubleshooting:
    echo 1. Check if Docker is running
    echo 2. Check if container '%CONTAINER_NAME%' exists
    echo 3. Verify database credentials
    exit /b 1
)

echo ========================================
echo Backup completed successfully!
echo ========================================

endlocal
