# Multi-Role Support Testing Guide

Complete guide for testing the multi-role user management system.

---

## Quick Start

### Automated Testing (Recommended)
```bash
cd tests
node test-multi-role.js
```

This runs a complete test suite covering all multi-role functionality.

---

## Manual Testing via Frontend UI

### Prerequisites
- Application running: `docker-compose up -d`
- Access frontend: http://localhost:8000
- Login credentials: `admin@rgp.com` / `admin123`

### Step-by-Step UI Testing

#### 1. View User Roles
1. Navigate to **Settings → Users**
2. Observe role badges next to each user name
3. Users with multiple roles show multiple badges

#### 2. Assign Additional Roles
1. Click **edit icon** (pencil) next to a user
2. Scroll to **"Assigned Roles"** section
3. Select a role from dropdown
4. Click **"Add Role"**
5. Role appears immediately in the list
6. Click **"Submit"** to save

#### 3. Remove Roles
1. In user edit page, find **"Assigned Roles"** section
2. Click **X** button next to any role
3. Confirmation prompt appears
4. Role is removed (if not the last one)
5. **Note:** Cannot remove last role - button will be disabled

#### 4. Verify Permission Merging
1. Assign multiple roles to a user
2. Logout and login with that user
3. Open browser DevTools (F12)
4. Go to Application → Local Storage
5. Find JWT token
6. Decode at https://jwt.io
7. Verify `role_ids` array contains multiple IDs
8. Verify `permissions` array is merged from all roles

---

## Manual Testing via API

### Setup
```bash
# Get JWT token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rgp.com","password":"admin123"}'

# Save token
TOKEN="paste-token-here"
```

### Test Commands

#### 1. Get User's Current Roles
```bash
curl -X GET http://localhost:3000/users/roles/2 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Array of role assignments with full role details

#### 2. Assign a Role
```bash
curl -X POST http://localhost:3000/users/roles/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":2,"roleId":2}'
```

**Expected:** New role assignment object with `id`, `user_id`, `role_id`

#### 3. Remove a Role
```bash
curl -X DELETE http://localhost:3000/users/roles/2/2 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Updated assignment with `active: false`

#### 4. Try to Remove Last Role (Should Fail)
```bash
# First ensure user has only 1 role, then try to remove it
curl -X DELETE http://localhost:3000/users/roles/2/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** 400 error with message about last role

#### 5. Refresh JWT Token
```bash
curl -X POST http://localhost:3000/users/roles/2/refresh-token \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** New token with updated permissions

#### 6. Get Merged Permissions (Debug)
```bash
curl -X GET http://localhost:3000/users/roles/2/permissions \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Array of merged permissions from all roles

#### 7. Get Role IDs (Debug)
```bash
curl -X GET http://localhost:3000/users/roles/2/role-ids \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** `{"roleIds": [1, 2, ...]}`

---

## Database Verification

### Check Role Assignments
```bash
docker exec rgp-db psql -U rgpapp -d rgpdb -c "
SELECT
  ura.id,
  ura.user_id,
  au.fullname,
  ar.name as role_name,
  ura.active,
  ura.assigned_on
FROM user_role_assignment ura
JOIN app_user au ON ura.user_id = au.id
JOIN app_role ar ON ura.role_id = ar.id
WHERE ura.active = true
ORDER BY ura.user_id, ura.assigned_on;
"
```

### Check Available Roles
```bash
docker exec rgp-db psql -U rgpapp -d rgpdb -c "
SELECT id, name, active FROM app_role WHERE active = true;
"
```

### View User with Roles
```bash
docker exec rgp-db psql -U rgpapp -d rgpdb -c "
SELECT
  au.id,
  au.fullname,
  au.email,
  array_agg(ar.name) as roles
FROM app_user au
LEFT JOIN user_role_assignment ura ON au.id = ura.user_id AND ura.active = true
LEFT JOIN app_role ar ON ura.role_id = ar.id
GROUP BY au.id, au.fullname, au.email
ORDER BY au.id;
"
```

---

## Test Scenarios

### Scenario 1: Basic Multi-Role Assignment
1. User starts with 1 role (Admin)
2. Assign "Sales Staff" role
3. Verify user has 2 roles
4. Login and check JWT has `role_ids: [1, 2]`
5. Verify permissions merged from both roles

### Scenario 2: Permission Merging
1. Admin role: Full access to all resources
2. Sales Staff role: Limited access to sales + stock
3. Merged result: Full access (Admin wins) + stock resource
4. Verify no duplicate permissions

### Scenario 3: Role Removal Protection
1. User has 2 roles
2. Remove one role - succeeds
3. User now has 1 role
4. Try to remove last role - fails with error
5. Verify user still has access

### Scenario 4: Dynamic Role Changes
1. Assign new role to user
2. User doesn't need to logout
3. Call refresh-token endpoint
4. User gets new JWT with updated permissions
5. Verify new permissions take effect immediately

---

## Common Issues & Solutions

### Issue: JWT doesn't contain role_ids
**Solution:** User needs to login again after role assignment to get updated JWT

### Issue: Frontend doesn't show new role
**Solution:** Refresh the page or navigate away and back

### Issue: Cannot assign role - "already assigned"
**Solution:** Role is already assigned. Check with GET /users/roles/:userId

### Issue: API returns 401 Unauthorized
**Solution:** JWT token expired. Login again to get new token

### Issue: Role removal doesn't work
**Solution:** Check if it's the last role. Last role cannot be removed.

---

## Performance Testing

### Test 1: JWT Size with Multiple Roles
```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rgp.com","password":"admin123"}' | \
  node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf-8')).token)")

# Check token size
echo $TOKEN | wc -c
```

**Expected:** ~3000-5000 characters (larger with more permissions)

### Test 2: Permission Resolution Speed
```bash
# Time the permission resolution
time curl -X GET http://localhost:3000/users/roles/2/permissions \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** < 100ms for permission resolution

---

## Available Roles

Default roles in the system:

1. **Admin (ID: 1)**
   - Full system access
   - User and role management
   - All resources and actions

2. **Sales Staff (ID: 2)**
   - Sales operations
   - Customer viewing
   - Limited stock access (no cost visibility)
   - HR attendance and leave

3. **Store Head (ID: 3)**
   - Store management
   - Stock and cash management
   - Sales and purchases
   - Limited admin functions

---

## Next Steps

After successful testing:

1. **Production Deployment**
   - Run migration `035_multi_role_support.sql`
   - Restart API service
   - Deploy frontend changes
   - Verify existing users migrated correctly

2. **User Training**
   - Show admin users how to assign multiple roles
   - Explain permission merging behavior
   - Document role assignment policies

3. **Monitoring**
   - Monitor JWT token sizes
   - Track API performance
   - Check for permission conflicts

---

## Support

For issues or questions:
- Check logs: `docker logs rgp-bo-api-1`
- Review API documentation: http://localhost:3000/api
- Consult main documentation: `docs/DYNAMIC_RBAC_MULTITENANCY_DESIGN.md`

---

**Last Updated:** 2026-01-11
**Version:** 1.0.0
