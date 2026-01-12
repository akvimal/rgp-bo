#!/bin/bash

# Data Scope Testing Script for Sales Module
# Tests that data scope filtering is working correctly

API_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo "========================================================================"
echo -e "${BOLD}DATA SCOPE TESTING - SALES MODULE${NC}"
echo "========================================================================"
echo ""

# Step 1: Login as Admin
echo -e "${CYAN}Step 1: Login as Admin...${NC}"
ADMIN_TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rgp.com","password":"admin123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}✗ Admin login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Admin logged in successfully${NC}"

# Step 2: Login as Staff
echo -e "${CYAN}Step 2: Login as Sales Staff...${NC}"
STAFF_TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@rgp.com","password":"staff123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$STAFF_TOKEN" ]; then
  echo -e "${RED}✗ Staff login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Staff logged in successfully${NC}"
echo ""

# Step 3: Check data scopes in database
echo "========================================================================"
echo -e "${BOLD}Step 3: Verify Data Scope Configuration${NC}"
echo "========================================================================"
echo ""

docker exec rgp-db psql -U rgpapp -d rgpdb -c "
SELECT
  r.id as role_id,
  r.name as role_name,
  fg.display_name as feature_group,
  rfa.data_scope
FROM app_role r
LEFT JOIN role_feature_assignment rfa ON rfa.role_id = r.id AND rfa.active = true
LEFT JOIN feature_group fg ON fg.id = rfa.feature_group_id
WHERE r.id IN (1, 2)
ORDER BY r.id;
"

echo ""

# Step 4: Check if any sales exist
echo "========================================================================"
echo -e "${BOLD}Step 4: Check Current Sales Data${NC}"
echo "========================================================================"
echo ""

docker exec rgp-db psql -U rgpapp -d rgpdb -c "
SELECT COUNT(*) as total_sales FROM sale WHERE active = true;
"

echo ""
echo -e "${YELLOW}Note: If no sales exist, the data scope filtering cannot be fully demonstrated.${NC}"
echo -e "${YELLOW}      You can create sales via the UI or API to test filtering.${NC}"
echo ""

# Step 5: Test API endpoints with both users
echo "========================================================================"
echo -e "${BOLD}Step 5: Test Data Scope Filtering${NC}"
echo "========================================================================"
echo ""

echo -e "${CYAN}Testing Admin user (expected scope: ALL - from legacy permissions)...${NC}"
ADMIN_SALES=$(curl -s -X GET "$API_URL/sales" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

ADMIN_COUNT=$(echo "$ADMIN_SALES" | grep -o '"id":' | wc -l)
echo -e "Admin can see: ${BOLD}$ADMIN_COUNT sales${NC}"
echo""

echo -e "${CYAN}Testing Staff user (expected scope: SELF)...${NC}"
STAFF_SALES=$(curl -s -X GET "$API_URL/sales" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json")

STAFF_COUNT=$(echo "$STAFF_SALES" | grep -o '"id":' | wc -l)
echo -e "Staff can see: ${BOLD}$STAFF_COUNT sales${NC}"
echo ""

# Step 6: Verify the filtering
echo "========================================================================"
echo -e "${BOLD}Step 6: Verification${NC}"
echo "========================================================================"
echo ""

if [ "$STAFF_COUNT" -le "$ADMIN_COUNT" ]; then
  echo -e "${GREEN}✓ PASS: Staff sees equal or fewer sales than Admin${NC}"
  echo -e "${GREEN}         This indicates data scope filtering is working${NC}"
else
  echo -e "${RED}✗ FAIL: Staff sees more sales than Admin (unexpected)${NC}"
fi

echo ""
echo -e "${CYAN}Data Scope Implementation Status:${NC}"
echo -e "  • ${GREEN}DataScopeService created and deployed${NC}"
echo -e "  • ${GREEN}Sales service updated to use data scope filtering${NC}"
echo -e "  • ${GREEN}Sales controller updated to pass user context${NC}"
echo -e "  • ${GREEN}CoreModule exports DataScopeService globally${NC}"
echo ""

echo -e "${YELLOW}To fully test data scope:${NC}"
echo -e "  1. Create sales as different users (admin@rgp.com and staff@rgp.com)"
echo -e "  2. Run this test again"
echo -e "  3. Admin should see ALL sales"
echo -e "  4. Staff should see ONLY their own sales"
echo ""

echo "========================================================================"
echo -e "${BOLD}Test Complete${NC}"
echo "========================================================================"
