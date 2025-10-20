# Database Migrations

This directory contains database migration scripts for schema evolution and performance optimization.

## Current Migrations

### 001 - Performance Indexes
- **Migration**: `001_add_performance_indexes.sql`
- **Rollback**: `001_rollback.sql`
- **Analysis**: `001_pre_deployment_analysis.sql`, `001_post_deployment_analysis.sql`
- **Guides**: `001_DEPLOYMENT_GUIDE.md`, `001_QUICK_START.md`
- **Purpose**: Add 66 performance indexes to optimize query performance (10-100x faster)
- **Impact**:
  - ✅ Massive performance improvement for customers, products, sales, and inventory queries
  - ✅ No downtime (uses CREATE INDEX CONCURRENTLY)
  - ✅ Optimizes foreign key lookups, status filtering, date ranges, and text search
  - ⚠️ Requires +10-20% disk space
  - ⏱️ Takes 15-45 minutes (depending on data size)

## Quick Start

```bash
# See full details in 001_QUICK_START.md

# 1. Pre-deployment analysis (save baseline metrics)
psql -U postgres -d your_db -f sql/migrations/001_pre_deployment_analysis.sql > pre_analysis.txt

# 2. Deploy performance indexes
psql -U postgres -d your_db -f sql/migrations/001_add_performance_indexes.sql

# 3. Post-deployment verification
psql -U postgres -d your_db -f sql/migrations/001_post_deployment_analysis.sql > post_analysis.txt

# 4. Compare results
diff pre_analysis.txt post_analysis.txt
```

## Docker Deployment

If using Docker containers:

```bash
# 1. Pre-deployment analysis
docker exec -i postgres_container psql -U postgres -d your_db < sql/migrations/001_pre_deployment_analysis.sql > pre_analysis.txt

# 2. Deploy indexes
docker exec -i postgres_container psql -U postgres -d your_db < sql/migrations/001_add_performance_indexes.sql

# 3. Post-deployment verification
docker exec -i postgres_container psql -U postgres -d your_db < sql/migrations/001_post_deployment_analysis.sql > post_analysis.txt
```

## Migration Status

| # | Description | Date | Status |
|---|-------------|------|--------|
| 001 | Performance indexes (66 indexes) | 2025-10-20 | ✅ Deployed |

## Migration Naming Convention

```
XXX_description_of_change.sql
XXX_rollback.sql
XXX_pre_deployment_analysis.sql (optional)
XXX_post_deployment_analysis.sql (optional)
XXX_DEPLOYMENT_GUIDE.md (optional, for complex migrations)
```

Where `XXX` is a sequential number (001, 002, 003, etc.)

## Best Practices

### Before Deploying

1. **Always backup** the database first
   ```bash
   pg_dump -U postgres your_db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```
2. **Test on staging** environment
3. **Review the migration** script carefully
4. **Check disk space** requirements
   ```bash
   df -h /var/lib/postgresql
   ```
5. **Read deployment guide** if available

### During Deployment

1. **Monitor progress** using PostgreSQL statistics
   ```sql
   SELECT * FROM pg_stat_progress_create_index;
   ```
2. **Watch for errors** in logs
3. **Don't interrupt** concurrent index builds
4. **Keep deployment logs** for reference

### After Deployment

1. **Verify success** using analysis scripts
2. **Test application** functionality
3. **Monitor performance** improvements
4. **Run VACUUM ANALYZE** if needed
   ```sql
   VACUUM ANALYZE;
   ```
5. **Keep rollback ready** (just in case)

## Rollback Procedures

Each migration has a corresponding rollback script:

```bash
# To rollback migration 001
psql -U postgres -d your_db -f sql/migrations/001_rollback.sql
```

**⚠️ WARNING**: Rollbacks may:
- Remove performance improvements
- Cause temporary performance degradation
- Require disk space for dropping indexes

## Development Workflow

### Creating a New Migration

1. **Number it sequentially**
   ```
   002_your_change_description.sql
   002_rollback.sql
   ```

2. **Add header comments**
   ```sql
   -- ============================================================================
   -- Migration: 002_your_change_description.sql
   -- Description: What this migration does
   -- Date: YYYY-MM-DD
   -- Impact: What will change
   -- Estimated Time: X minutes
   -- ============================================================================
   ```

3. **Test thoroughly**
   - Test on local database
   - Test on staging environment
   - Test rollback script
   - Document any issues

4. **Create deployment guide** (for complex migrations)
   ```
   002_DEPLOYMENT_GUIDE.md
   ```

5. **Update this README**
   - Add to migration status table
   - Document purpose and impact
   - Note any special instructions

### Testing Migrations

```bash
# Create test database
createdb test_db
pg_restore -d test_db your_backup.sql

# Test forward migration
psql -U postgres -d test_db -f sql/migrations/XXX_migration.sql

# Test rollback
psql -U postgres -d test_db -f sql/migrations/XXX_rollback.sql

# Verify both work correctly
```

## Monitoring and Utilities

### Check Database Performance

```sql
-- Buffer cache hit ratio (should be > 95%)
SELECT
    round(100.0 * sum(blks_hit) / nullif(sum(blks_hit + blks_read), 0), 2) AS cache_hit_ratio
FROM pg_stat_database;

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage statistics
SELECT
    schemaname,
    tablename,
    indexrelname,
    idx_scan as scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Sequential vs Index scans
SELECT
    schemaname,
    tablename,
    seq_scan,
    idx_scan,
    CASE WHEN seq_scan + idx_scan > 0
         THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 2)
         ELSE 0
    END AS seq_scan_percentage
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;
```

### Monitor Index Creation Progress

```sql
-- Check progress of concurrent index creation (refresh every 5 seconds)
SELECT
    datname,
    pid,
    phase,
    round(100.0 * blocks_done / nullif(blocks_total, 0), 1) AS "% complete",
    current_timestamp
FROM pg_stat_progress_create_index;
\watch 5
```

### Check for Invalid Indexes

```sql
-- Find invalid indexes (need to be dropped and recreated)
SELECT
    schemaname,
    tablename,
    indexrelname
FROM pg_stat_user_indexes pui
JOIN pg_index pi ON pui.indexrelid = pi.indexrelid
WHERE NOT pi.indisvalid;
```

## Common Issues and Solutions

### Issue: Migration Hangs

**Symptoms**: Migration script runs indefinitely

**Solutions**:
```sql
-- Check for blocking queries
SELECT pid, query, state, wait_event_type
FROM pg_stat_activity
WHERE state != 'idle';

-- Cancel blocking query (if safe)
SELECT pg_cancel_backend(pid);

-- Or terminate (more aggressive)
SELECT pg_terminate_backend(pid);
```

### Issue: Out of Disk Space

**Symptoms**: ERROR: could not extend file

**Solutions**:
- Free up disk space
- Increase available storage
- Deploy indexes in batches (split migration file)

### Issue: Permission Denied

**Symptoms**: ERROR: permission denied

**Solutions**:
- Run as database superuser
- Grant necessary permissions
- Check table ownership

### Issue: Index Creation Fails

**Symptoms**: ERROR during CREATE INDEX

**Solutions**:
```sql
-- Check for invalid indexes
SELECT indexrelid::regclass, indisvalid
FROM pg_index
WHERE NOT indisvalid;

-- Drop invalid index
DROP INDEX CONCURRENTLY invalid_index_name;

-- Recreate the index
CREATE INDEX CONCURRENTLY ...
```

## Performance Expectations

After deploying migration 001 (Performance Indexes):

| Query Type | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Customer lookup by email/mobile | 500ms | 5ms | **100x faster** |
| Sale filtering by status | 1000ms | 10ms | **100x faster** |
| Product inventory queries | 2000ms | 20ms | **100x faster** |
| Date range reports | 3000ms | 50ms | **60x faster** |
| Invoice search | 800ms | 10ms | **80x faster** |

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [Index Maintenance](https://www.postgresql.org/docs/current/routine-reindex.html)
- [Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

## Support

For questions or issues with migrations:
- Review the deployment guide for the specific migration
- Check PostgreSQL logs: `/var/log/postgresql/`
- Create a GitHub issue with error details
- Contact the database team

---

**Last Updated**: 2025-10-20
**Latest Migration**: 001 (Performance Indexes)
**Total Migrations**: 1
**Database Version**: PostgreSQL 14+
