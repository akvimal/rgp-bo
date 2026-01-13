@echo off
REM ==============================================================================
REM Cleanup Temporary Files Script (Windows)
REM ==============================================================================
REM Description: Removes temporary files created by Claude Code and other tools
REM Usage: cleanup-temp-files.bat [--logs]
REM Options:
REM   --logs    Also remove log files (*.log)
REM ==============================================================================

echo.
echo ========================================
echo   RGP Back Office - Cleanup Temporary Files
echo ========================================
echo.

REM Get the project root directory (parent of scripts folder)
cd /d "%~dp0.."

REM Count and remove tmpclaude-*-cwd files
echo [1/4] Checking for temporary Claude working directory files...
set COUNT=0
for %%F in (tmpclaude-*-cwd) do set /a COUNT+=1
for /r %%F in (tmpclaude-*-cwd) do set /a COUNT+=1

if %COUNT% GTR 0 (
    echo       Found %COUNT% temporary Claude files
    echo       Removing...
    del /q tmpclaude-*-cwd 2>nul
    for /r %%d in (.) do (
        if exist "%%d\tmpclaude-*-cwd" del /q "%%d\tmpclaude-*-cwd" 2>nul
    )
    echo       [OK] Removed temporary Claude files
) else (
    echo       [OK] No temporary Claude files found
)

echo.
echo [2/4] Checking for other temporary files...
set TEMP_COUNT=0
for %%F in (*.tmp *.temp) do set /a TEMP_COUNT+=1

if %TEMP_COUNT% GTR 0 (
    echo       Found %TEMP_COUNT% .tmp/.temp files
    echo       Removing...
    del /q *.tmp *.temp 2>nul
    echo       [OK] Removed temporary files
) else (
    echo       [OK] No .tmp/.temp files found
)

REM Optional: Remove log files if --logs flag is passed
echo.
echo [3/4] Checking for log files...
if "%1"=="--logs" (
    set LOG_COUNT=0
    for %%F in (*.log) do set /a LOG_COUNT+=1

    if %LOG_COUNT% GTR 0 (
        echo       Found %LOG_COUNT% log files
        echo       Removing...
        del /q *.log 2>nul
        echo       [OK] Removed log files
    ) else (
        echo       [OK] No log files found
    )
) else (
    echo       [SKIP] Use --logs flag to remove log files
)

echo.
echo [4/4] Verifying cleanup...
set REMAINING=0
for %%F in (tmpclaude-*-cwd *.tmp *.temp) do set /a REMAINING+=1

if %REMAINING% EQU 0 (
    echo       [OK] All temporary files cleaned
) else (
    echo       [WARN] %REMAINING% files remaining
)

echo.
echo ========================================
echo   Cleanup Complete!
echo ========================================
echo.
echo Summary:
echo   - Temporary Claude files removed
echo   - .tmp/.temp files removed
if "%1"=="--logs" (
    echo   - Log files removed
) else (
    echo   - Log files kept (use --logs to remove)
)
echo.
echo Tip: These files are gitignored and won't be committed.
echo      You can run this script anytime to clean up.
echo.

pause
