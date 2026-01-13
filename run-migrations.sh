#!/bin/bash
# ==============================================================================
# Database Migration Runner Script
# ==============================================================================
# Description: Run database migrations for RBAC, Payroll, and other features
# Usage: ./run-migrations.sh
# ==============================================================================

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "  RGP Back Office - Database Migrations"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker ps >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker is not running!"
    echo "Please start Docker and try again."
    echo ""
    exit 1
fi

# Check if database container is running
if ! docker ps --filter "name=rgp-db" --format "{{.Names}}" | grep -q rgp-db; then
    echo -e "${RED}[ERROR]${NC} Database container 'rgp-db' is not running!"
    echo "Please start the database with: docker-compose up -d"
    echo ""
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Docker and database container are running"
echo ""

# Change to script directory (project root)
cd "$(dirname "$0")" || exit 1

echo "========================================"
echo "  Running RBAC Migrations"
echo "========================================"
echo ""

# Migration 1: Feature Groups and Access Levels
echo -e "${BLUE}[1/3]${NC} Running 012_feature_groups_access_levels.sql..."
if docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/012_feature_groups_access_levels.sql; then
    echo -e "${GREEN}[OK]${NC} Migration 012 completed"
else
    echo -e "${RED}[ERROR]${NC} Migration 012_feature_groups_access_levels.sql failed!"
    exit 1
fi
echo ""

# Migration 2: Complete Feature Group Access Levels
echo -e "${BLUE}[2/3]${NC} Running 013_complete_feature_group_access_levels.sql..."
if docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/013_complete_feature_group_access_levels.sql; then
    echo -e "${GREEN}[OK]${NC} Migration 013 completed"
else
    echo -e "${RED}[ERROR]${NC} Migration 013_complete_feature_group_access_levels.sql failed!"
    exit 1
fi
echo ""

# Migration 3: Multi-Role Support
echo -e "${BLUE}[3/3]${NC} Running 035_multi_role_support.sql..."
if docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/035_multi_role_support.sql; then
    echo -e "${GREEN}[OK]${NC} Migration 035 completed"
else
    echo -e "${RED}[ERROR]${NC} Migration 035_multi_role_support.sql failed!"
    exit 1
fi
echo ""

echo "========================================"
echo "  All Migrations Completed Successfully!"
echo "========================================"
echo ""
echo "Summary:"
echo -e "  ${GREEN}[OK]${NC} Feature Groups and Access Levels (012)"
echo -e "  ${GREEN}[OK]${NC} Complete Feature Group Access Levels (013)"
echo -e "  ${GREEN}[OK]${NC} Multi-Role Support (035)"
echo ""
echo "Database is ready with:"
echo "  - RBAC system with feature groups"
echo "  - Granular access levels"
echo "  - Multi-role support for users"
echo ""
echo "Next steps:"
echo "  1. Restart the API: docker-compose restart api"
echo "  2. Test RBAC features in the application"
echo "  3. Configure roles and permissions as needed"
echo ""
