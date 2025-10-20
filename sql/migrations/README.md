# Database Migrations

This directory contains database migration scripts to evolve the database schema and optimize performance.

## Migration Files

### 001 - Initial Setup
*Previous migrations - see git history*

### 002 - Fix Bill Number Race Condition
- **File**: `002_fix_bill_number_race_condition.sql`
- **Rollback**: `002_rollback.sql`
- **Purpose**: Prevents duplicate bill numbers in concurrent transactions
- **Status**: ✅ Deployed

### 003 - Add Performance Indexes (NEW)
- **Migration**: `003_add_performance_indexes.sql`
- **Rollback**: `003_rollback.sql`
- **Analysis**: `003_pre_deployment_analysis.sql`, `003_post_deployment_analysis.sql`
- **Guides**: `003_DEPLOYMENT_GUIDE.md`, `003_QUICK_START.md`
- **Purpose**: Add 78 indexes to optimize query performance (10-100x faster)
- **Status**: 🆕 Ready to deploy
- **Impact**:
  - ✅ Massive performance improvement
  - ✅ No downtime (uses CONCURRENT)
  - ⚠️ Requires +10-20% disk space
  - ⏱️ Takes 15-45 minutes

## Quick Start - Migration 003

```bash
# See full details in 003_QUICK_START.md

# 1. Pre-deployment check
psql -U postgres -d your_db -f sql/migrations/003_pre_deployment_analysis.sql

# 2. Deploy indexes
psql -U postgres -d your_db -f sql/migrations/003_add_performance_indexes.sql

# 3. Verify results
psql -U postgres -d your_db -f sql/migrations/003_post_deployment_analysis.sql
```

## Migration Naming Convention

```
XXX_description_of_change.sql
XXX_rollback.sql
```

Where `XXX` is a sequential number (001, 002, 003, etc.)

## Best Practices

### Before Deploying

1. **Always backup** the database first
2. **Test on staging** environment
3. **Review the migration** script carefully
4. **Check disk space** requirements
5. **Read deployment guide** if available

### During Deployment

1. **Monitor progress** (especially for long-running migrations)
2. **Watch for errors** in logs
3. **Don't interrupt** concurrent index builds
4. **Keep deployment logs** for reference

### After Deployment

1. **Verify success** using analysis scripts
2. **Test application** functionality
3. **Monitor performance** improvements
4. **Update documentation**
5. **Keep rollback ready** (just in case)

## Migration Status Tracking

| # | Description | Deployed Date | Rolled Back | Notes |
|---|-------------|---------------|-------------|-------|
| 001 | Initial schema | - | - | Historical |
| 002 | Bill number race fix | - | - | ✅ Active |
| 003 | Performance indexes | - | - | 🆕 Ready |

## Database Schema Files

- `sql/ddl/tables.sql` - Table definitions
- `sql/ddl/views.sql` - View definitions
- `sql/ddl/functions.sql` - Function definitions
- `sql/ddl/sequences.sql` - Sequence definitions

## Support

### For Migration Issues

1. Check the deployment guide for that migration
2. Review PostgreSQL logs: `/var/log/postgresql/`
3. Check `pg_stat_activity` for blocking queries
4. Use rollback script if necessary

### Common Issues

**Issue**: Migration hangs
- **Solution**: Check for long-running transactions or locks

**Issue**: Out of disk space
- **Solution**: Free up space or use partial deployment

**Issue**: Permission denied
- **Solution**: Run as database superuser or owner

**Issue**: Index creation fails
- **Solution**: Check for invalid indexes and drop them

## Rollback Procedures

Each migration should have a corresponding rollback script:

```bash
# To rollback migration 003
psql -U postgres -d your_db -f sql/migrations/003_rollback.sql
```

**⚠️ WARNING**: Rollbacks may:
- Remove performance improvements
- Cause downtime (depending on migration)
- Require data cleanup

## Development Workflow

### Creating a New Migration

1. **Number it sequentially**
   ```
   004_your_change_description.sql
   004_rollback.sql
   ```

2. **Add header comments**
   ```sql
   -- ============================================================================
   -- Migration: 004_your_change_description.sql
   -- Description: What this migration does
   -- Date: YYYY-MM-DD
   -- Impact: What will change
   -- ============================================================================
   ```

3. **Test thoroughly**
   - Test on local database
   - Test on staging
   - Test rollback script
   - Document any issues

4. **Create deployment guide** (for complex migrations)
   ```
   004_DEPLOYMENT_GUIDE.md
   ```

5. **Update this README**
   - Add to migration table
   - Update status
   - Note any special instructions

### Testing Migrations

```bash
# Test forward migration
psql -U postgres -d test_db -f sql/migrations/XXX_migration.sql

# Test rollback
psql -U postgres -d test_db -f sql/migrations/XXX_rollback.sql

# Verify both work correctly
```

## Tools and Utilities

### Check Current Schema Version

```sql
-- Check applied migrations (if using migration tracking table)
SELECT * FROM schema_migrations ORDER BY version;
```

### Analyze Database Performance

```sql
-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Monitor Active Migrations

```sql
-- Check progress of concurrent index creation
SELECT
    datname,
    pid,
    phase,
    round(100.0 * blocks_done / nullif(blocks_total, 0), 1) AS "% complete"
FROM pg_stat_progress_create_index;
```

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [Migration Best Practices](https://www.postgresql.org/docs/current/tutorial-concepts.html)

## Contact

For questions or issues with migrations:
- Create a GitHub issue
- Contact the database team
- Review deployment guides

---

**Last Updated**: 2025-10-19
**Latest Migration**: 003 (Performance Indexes)
**Next Migration**: TBD
