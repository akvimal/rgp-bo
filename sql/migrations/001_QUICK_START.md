# Quick Start Guide - Index Migration

## TL;DR - Fast Deployment

```bash
# 1. Pre-deployment analysis (save output)
psql -U your_user -d your_db -f sql/migrations/001_pre_deployment_analysis.sql > pre_analysis.txt

# 2. Deploy indexes
psql -U your_user -d your_db -f sql/migrations/001_add_performance_indexes.sql

# 3. Post-deployment verification (save output)
psql -U your_user -d your_db -f sql/migrations/001_post_deployment_analysis.sql > post_analysis.txt

# 4. Compare results
diff pre_analysis.txt post_analysis.txt
```

## Execution Order

### Step 1: Pre-Deployment Analysis (5 minutes)
**Purpose**: Baseline performance metrics

```bash
psql -U postgres -d rgp_db \
  -f sql/migrations/001_pre_deployment_analysis.sql \
  -o analysis_before_$(date +%Y%m%d_%H%M%S).txt
```

**What it does**:
- ✅ Checks database size
- ✅ Counts current indexes
- ✅ Runs baseline performance tests
- ✅ Shows sequential scan statistics
- ✅ Measures cache hit ratio

### Step 2: Deploy Indexes (15-45 minutes)
**Purpose**: Create all performance indexes

```bash
psql -U postgres -d rgp_db \
  -f sql/migrations/001_add_performance_indexes.sql \
  2>&1 | tee deployment_$(date +%Y%m%d_%H%M%S).log
```

**Monitor progress** (in another terminal):
```sql
-- Real-time progress
SELECT
    phase,
    round(100.0 * blocks_done / nullif(blocks_total, 0), 1) AS "% complete",
    current_timestamp
FROM pg_stat_progress_create_index;

-- Refresh every 5 seconds
\watch 5
```

### Step 3: Post-Deployment Verification (5 minutes)
**Purpose**: Verify indexes and measure improvements

```bash
psql -U postgres -d rgp_db \
  -f sql/migrations/001_post_deployment_analysis.sql \
  -o analysis_after_$(date +%Y%m%d_%H%M%S).txt
```

**What it does**:
- ✅ Verifies all indexes created
- ✅ Runs same performance tests
- ✅ Shows index usage statistics
- ✅ Identifies potentially unused indexes
- ✅ Checks for invalid indexes

### Step 4: Compare Results
**Look for**:
- Query plans showing "Index Scan" instead of "Seq Scan"
- Lower execution times (should be 10-100x faster)
- Higher index scan counts
- Lower sequential scan percentages

---

## Connection String Examples

### Local PostgreSQL
```bash
psql -h localhost -p 5432 -U postgres -d rgp_db -f sql/migrations/001_add_performance_indexes.sql
```

### Docker Container
```bash
docker exec -i postgres_container psql -U postgres -d rgp_db < sql/migrations/001_add_performance_indexes.sql
```

### Remote Server
```bash
psql "postgresql://user:password@remote-host:5432/rgp_db?sslmode=require" \
  -f sql/migrations/001_add_performance_indexes.sql
```

### Using .pgpass file
```bash
# Create ~/.pgpass (chmod 600)
echo "localhost:5432:rgp_db:postgres:your_password" > ~/.pgpass
chmod 600 ~/.pgpass

# Then run without password prompt
psql -h localhost -U postgres -d rgp_db -f sql/migrations/001_add_performance_indexes.sql
```

---

## Production Deployment Checklist

### Before Deployment
- [ ] **Backup database** (pg_dump or snapshot)
- [ ] **Check disk space** (need ~20% more)
- [ ] **Verify PostgreSQL version** (9.2+)
- [ ] **Run pre-deployment analysis**
- [ ] **Review deployment guide** (001_DEPLOYMENT_GUIDE.md)
- [ ] **Inform team** (deployment in progress)

### During Deployment
- [ ] **Start deployment** (run migration script)
- [ ] **Monitor progress** (pg_stat_progress_create_index)
- [ ] **Watch for errors** (check logs)
- [ ] **Verify no locks** (check pg_locks)

### After Deployment
- [ ] **Run post-deployment analysis**
- [ ] **Verify all indexes created** (should be ~78)
- [ ] **Check for invalid indexes** (drop and recreate)
- [ ] **Test application** (verify no errors)
- [ ] **Monitor performance** (should be faster)
- [ ] **Compare before/after results**
- [ ] **Update documentation**

---

## Rollback (Emergency Only)

**If you need to rollback**:
```bash
psql -U postgres -d rgp_db -f sql/migrations/001_rollback.sql
```

**WARNING**: This will:
- ❌ Remove all performance indexes
- ❌ Restore slow query performance
- ❌ Increase sequential scans

**Only rollback if**:
- Deployment failed partway
- Indexes cause unexpected issues
- Critical disk space shortage

---

## Troubleshooting Quick Reference

### Issue: Index creation hangs

```sql
-- Check for blocking queries
SELECT pid, query, state, wait_event_type
FROM pg_stat_activity
WHERE state != 'idle';

-- Cancel if needed
SELECT pg_cancel_backend(pid);
```

### Issue: Out of memory

```sql
-- Increase memory temporarily
SET maintenance_work_mem = '2GB';

-- Then retry
```

### Issue: Disk space full

```bash
# Check space
df -h

# Find large files
du -sh /var/lib/postgresql/data/* | sort -h
```

### Issue: Invalid indexes after deployment

```sql
-- Find invalid indexes
SELECT indexrelid::regclass, indisvalid
FROM pg_index
WHERE NOT indisvalid;

-- Drop invalid index
DROP INDEX CONCURRENTLY invalid_index_name;

-- Recreate
CREATE INDEX CONCURRENTLY ...
```

---

## Performance Validation

### Quick Performance Test

```sql
-- Before: Slow query (full table scan)
EXPLAIN ANALYZE
SELECT * FROM sale WHERE customer_id = 123 AND active = true;
-- Execution time: ~500ms

-- After: Fast query (index scan)
EXPLAIN ANALYZE
SELECT * FROM sale WHERE customer_id = 123 AND active = true;
-- Execution time: ~5ms
-- Should show: Index Scan using idx_sale_customer_id
```

### Verify Index Usage

```sql
-- Top 10 most-used indexes
SELECT
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 10;
```

---

## Files Reference

| File | Purpose | Duration |
|------|---------|----------|
| `001_pre_deployment_analysis.sql` | Baseline metrics | 5 min |
| `001_add_performance_indexes.sql` | Create indexes | 15-45 min |
| `001_post_deployment_analysis.sql` | Verify results | 5 min |
| `001_rollback.sql` | Remove indexes | 10-20 min |
| `001_DEPLOYMENT_GUIDE.md` | Full documentation | - |
| `001_QUICK_START.md` | This file | - |

---

## Expected Results

### Performance Improvements

| Query Type | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Customer lookup | 500ms | 5ms | 100x faster |
| Status filter | 1000ms | 10ms | 100x faster |
| Inventory query | 2000ms | 20ms | 100x faster |
| Product search | 300ms | 30ms | 10x faster |

### Storage Impact

| Metric | Value |
|--------|-------|
| New indexes | ~78 |
| Size increase | +10-20% |
| Query improvement | 10-100x faster |

---

## Support

**For issues**:
1. Check troubleshooting section above
2. Review PostgreSQL logs: `/var/log/postgresql/`
3. Consult full guide: `001_DEPLOYMENT_GUIDE.md`
4. Create GitHub issue with error details

**For questions**:
- When to deploy? **Anytime** (CONCURRENT = no downtime)
- How long? **15-45 minutes** (depends on data size)
- Can I rollback? **Yes** (use 001_rollback.sql)
- Is it safe? **Yes** (no table locking)

---

## Success Criteria

✅ **Deployment successful if**:
- All 78 indexes created
- No invalid indexes
- Queries show "Index Scan" in EXPLAIN plans
- Application performance improved
- No errors in logs

🎉 **You're done!** Enjoy 10-100x faster queries!
