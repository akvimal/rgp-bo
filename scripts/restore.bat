@echo off
REM Database Restore Script for RGP Back Office
REM Restores database from a backup file

setlocal

REM Configuration
set BACKUP_DIR=backups
set CONTAINER_NAME=rgp-postgres
set DB_NAME=rgpdb
set DB_USER=rgpapp

if "%~1"=="" (
    echo ========================================
    echo RGP Database Restore Script
    echo ========================================
    echo ERROR: No backup file specified!
    echo.
    echo Usage: restore.bat [backup_file]
    echo.
    echo Available backups:
    dir /b %BACKUP_DIR%\backup_*.sql 2>nul
    exit /b 1
)

set BACKUP_FILE=%~1

if not exist "%BACKUP_FILE%" (
    echo ERROR: Backup file '%BACKUP_FILE%' not found!
    exit /b 1
)

echo ========================================
echo RGP Database Restore Script
echo ========================================
echo Container: %CONTAINER_NAME%
echo Database: %DB_NAME%
echo Backup File: %BACKUP_FILE%
echo ========================================
echo.
echo WARNING: This will overwrite the current database!
set /p CONFIRM=Are you sure you want to continue? (yes/no):

if /i not "%CONFIRM%"=="yes" (
    echo Restore cancelled.
    exit /b 0
)

echo.
echo Restoring database...
type "%BACKUP_FILE%" | docker exec -i %CONTAINER_NAME% psql -U %DB_USER% %DB_NAME%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS: Database restored from %BACKUP_FILE%
    echo ========================================
) else (
    echo.
    echo ========================================
    echo ERROR: Restore failed!
    echo ========================================
    exit /b 1
)

endlocal
