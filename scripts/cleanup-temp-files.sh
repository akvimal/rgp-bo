#!/bin/bash
# ==============================================================================
# Cleanup Temporary Files Script (Unix/Linux/Mac)
# ==============================================================================
# Description: Removes temporary files created by Claude Code and other tools
# Usage: ./cleanup-temp-files.sh [--logs]
# Options:
#   --logs    Also remove log files (*.log)
# ==============================================================================

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "  RGP Back Office - Cleanup Temporary Files"
echo "========================================"
echo ""

# Get the project root directory (parent of scripts folder)
cd "$(dirname "$0")/.." || exit 1

# Function to count files matching pattern
count_files() {
    local pattern="$1"
    local count=0
    count=$(find . -name "$pattern" -type f 2>/dev/null | wc -l)
    echo "$count"
}

# [1/4] Remove tmpclaude-*-cwd files
echo -e "${BLUE}[1/4]${NC} Checking for temporary Claude working directory files..."
CLAUDE_COUNT=$(count_files "tmpclaude-*-cwd")

if [ "$CLAUDE_COUNT" -gt 0 ]; then
    echo "      Found $CLAUDE_COUNT temporary Claude files"
    echo "      Removing..."
    find . -name "tmpclaude-*-cwd" -type f -delete 2>/dev/null
    echo -e "      ${GREEN}[OK]${NC} Removed temporary Claude files"
else
    echo -e "      ${GREEN}[OK]${NC} No temporary Claude files found"
fi

echo ""

# [2/4] Remove .tmp and .temp files
echo -e "${BLUE}[2/4]${NC} Checking for other temporary files..."
TMP_COUNT=$(count_files "*.tmp")
TEMP_COUNT=$(count_files "*.temp")
TOTAL_TEMP=$((TMP_COUNT + TEMP_COUNT))

if [ "$TOTAL_TEMP" -gt 0 ]; then
    echo "      Found $TOTAL_TEMP .tmp/.temp files"
    echo "      Removing..."
    find . -name "*.tmp" -type f -delete 2>/dev/null
    find . -name "*.temp" -type f -delete 2>/dev/null
    echo -e "      ${GREEN}[OK]${NC} Removed temporary files"
else
    echo -e "      ${GREEN}[OK]${NC} No .tmp/.temp files found"
fi

echo ""

# [3/4] Optional: Remove log files if --logs flag is passed
echo -e "${BLUE}[3/4]${NC} Checking for log files..."
if [ "$1" == "--logs" ]; then
    LOG_COUNT=$(count_files "*.log")

    if [ "$LOG_COUNT" -gt 0 ]; then
        echo "      Found $LOG_COUNT log files"
        echo "      Removing..."
        find . -name "*.log" -type f -delete 2>/dev/null
        echo -e "      ${GREEN}[OK]${NC} Removed log files"
    else
        echo -e "      ${GREEN}[OK]${NC} No log files found"
    fi
else
    echo -e "      ${YELLOW}[SKIP]${NC} Use --logs flag to remove log files"
fi

echo ""

# [4/4] Verify cleanup
echo -e "${BLUE}[4/4]${NC} Verifying cleanup..."
REMAINING_CLAUDE=$(count_files "tmpclaude-*-cwd")
REMAINING_TMP=$(count_files "*.tmp")
REMAINING_TEMP=$(count_files "*.temp")
REMAINING_TOTAL=$((REMAINING_CLAUDE + REMAINING_TMP + REMAINING_TEMP))

if [ "$REMAINING_TOTAL" -eq 0 ]; then
    echo -e "      ${GREEN}[OK]${NC} All temporary files cleaned"
else
    echo -e "      ${YELLOW}[WARN]${NC} $REMAINING_TOTAL files remaining"
fi

echo ""
echo "========================================"
echo "  Cleanup Complete!"
echo "========================================"
echo ""
echo "Summary:"
echo "  - Temporary Claude files removed"
echo "  - .tmp/.temp files removed"
if [ "$1" == "--logs" ]; then
    echo "  - Log files removed"
else
    echo "  - Log files kept (use --logs to remove)"
fi
echo ""
echo "Tip: These files are gitignored and won't be committed."
echo "     You can run this script anytime to clean up."
echo ""
