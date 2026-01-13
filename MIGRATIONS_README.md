# Database Migrations Guide

This guide explains how to run the database migrations for the RBAC, Payroll, and Data Scope features that were merged in PR #93.

---

## Quick Start

### Prerequisites

1. **Docker Desktop must be running**
2. **Database container must be running**
   ```bash
   docker-compose up -d
   ```

### Running Migrations

**Windows:**
```cmd
run-migrations.bat
```

**Unix/Linux/Mac:**
```bash
./run-migrations.sh
```

---

## What Gets Migrated

### 1. Feature Groups and Access Levels (Migration 012)
- Creates RBAC infrastructure tables
- Sets up feature groups and sub-features hierarchy
- Defines access levels (VIEW, CREATE, UPDATE, DELETE, FULL)
- Adds sample feature groups for Sales, Purchases, Inventory, etc.

**Tables Created:**
- `feature_group`
- `sub_feature`
- `access_level`
- `role_feature_assignment`
- `role_sub_feature_assignment`
- `sub_feature_access_level`

**File:** `sql/migrations/012_feature_groups_access_levels.sql`

### 2. Complete Feature Group Access Levels (Migration 013)
- Completes the feature group structure
- Adds remaining feature groups and sub-features
- Sets up default access levels for all features

**File:** `sql/migrations/013_complete_feature_group_access_levels.sql`

### 3. Multi-Role Support (Migration 035)
- Adds multi-role support for users
- Creates user-role assignment tables
- Enables users to have multiple roles simultaneously
- Includes permission checking infrastructure

**Tables Created:**
- `role_master`
- `user_role_assignment`

**File:** `sql/migrations/035_multi_role_support.sql`

---

## Manual Migration Steps

If you prefer to run migrations manually:

```bash
# 1. Check Docker is running
docker ps

# 2. Run migrations in order
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/012_feature_groups_access_levels.sql

docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/013_complete_feature_group_access_levels.sql

docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/035_multi_role_support.sql

# 3. Restart the API
docker-compose restart api
```

---

## Verification

### Check Tables Were Created

```bash
# Connect to database
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# List RBAC tables
\dt *feature*
\dt *role*
\dt *access*

# Check feature groups
SELECT id, name, description FROM feature_group ORDER BY id;

# Check access levels
SELECT id, level FROM access_level ORDER BY id;

# Exit
\q
```

### Expected Feature Groups

After migration, you should have these feature groups:
1. Sales Management
2. Purchases Management
3. Inventory Management
4. Customer Management
5. Vendor Management
6. User Management
7. Reports
8. Settings
9. HR Management

### Expected Access Levels

1. VIEW (1) - Can view data
2. CREATE (2) - Can create new records
3. UPDATE (3) - Can edit existing records
4. DELETE (4) - Can delete records
5. FULL (5) - Full access (all permissions)

---

## Rollback

If you need to rollback the migrations:

```bash
# Rollback in reverse order
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/035_rollback.sql

docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/013_rollback.sql

docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/012_rollback.sql
```

**Warning:** Rollback will delete all RBAC data including role assignments and permissions!

---

## Troubleshooting

### Error: Docker is not running
**Solution:** Start Docker Desktop and wait for it to fully start, then try again.

### Error: Database container not found
**Solution:**
```bash
# Start all services
docker-compose up -d

# Check containers are running
docker ps
```

### Error: Migration already applied
If you see errors like "table already exists", the migration may have been partially applied.

**Solutions:**
1. Check which tables exist: `\dt` in psql
2. Run rollback scripts to clean up
3. Re-run migrations from scratch

### Error: Permission denied
**Solution:**
```bash
# Make script executable (Unix/Mac)
chmod +x run-migrations.sh
```

---

## Post-Migration Tasks

### 1. Restart the API
```bash
docker-compose restart api
```

### 2. Configure Roles and Permissions

Access the role management UI:
- Navigate to Settings → Roles
- Create custom roles with specific permissions
- Assign feature groups and access levels

### 3. Assign Roles to Users

Access user management UI:
- Navigate to Settings → Users
- Edit users to assign roles
- Users can have multiple roles

### 4. Test RBAC Features

- Login with different user roles
- Verify permissions are enforced
- Check data scope filtering works correctly

---

## Migration Scripts Location

All migration files are in: `sql/migrations/`

**RBAC Migrations:**
- `012_feature_groups_access_levels.sql`
- `012_rollback.sql`
- `013_complete_feature_group_access_levels.sql`
- `013_rollback.sql`
- `035_multi_role_support.sql`
- `035_rollback.sql`

**Documentation:**
- `GIT_COMMIT_SUMMARY.md` - Detailed commit history
- `MIGRATION_TESTING_RESULTS.md` - Test results

---

## Additional Documentation

For detailed information about the RBAC system:

- **Quick Start:** `docs/DYNAMIC_RBAC_QUICK_START.md`
- **Design Document:** `docs/FEATURE_GROUPS_ACCESS_LEVELS_DESIGN.md`
- **Implementation:** `docs/FEATURE_GROUPS_IMPLEMENTATION_COMPLETE.md`
- **Testing Guide:** `docs/MULTI_ROLE_TESTING_GUIDE.md`

For data scope filtering:

- **Implementation:** `docs/DATA_SCOPE_IMPLEMENTATION_SALES.md`
- **Testing Guide:** `docs/DATA_SCOPE_TESTING_GUIDE.md`

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review migration test results: `sql/migrations/MIGRATION_TESTING_RESULTS.md`
3. Check application logs: `docker logs rgp-bo-api-1`
4. Verify database logs: `docker logs rgp-db`

---

**Last Updated:** 2026-01-13
**Migrations Version:** PR #93
**Database:** PostgreSQL 17
