# PostgreSQL Performance Tuning Guide

This guide explains the PostgreSQL performance optimizations configured in the docker-compose files and provides recommendations for different system configurations.

## Quick Start

The default settings are optimized for a **4GB RAM system**. To apply these settings:

```bash
# Restart PostgreSQL with new settings
docker-compose -f docker-compose.prod.yml restart postgres
```

## Performance Settings Explained

### Memory Configuration

#### 1. `shared_buffers` (Default: 256MB)
- **Purpose**: RAM used by PostgreSQL for caching data pages
- **Recommendation**: 25% of total system RAM (max 8GB)
- **Impact**: Higher values reduce disk I/O by keeping more data in memory

**System RAM recommendations:**
- 2GB RAM: 512MB
- 4GB RAM: 1GB
- 8GB RAM: 2GB
- 16GB RAM: 4GB
- 32GB+ RAM: 8GB (max recommended)

#### 2. `effective_cache_size` (Default: 1GB)
- **Purpose**: Hints to the query planner about total cache available
- **Recommendation**: 50-75% of total system RAM
- **Impact**: Better query plans for large datasets

**System RAM recommendations:**
- 2GB RAM: 1GB
- 4GB RAM: 2-3GB
- 8GB RAM: 4-6GB
- 16GB RAM: 8-12GB
- 32GB RAM: 16-24GB

#### 3. `work_mem` (Default: 16MB)
- **Purpose**: RAM per operation (sorts, hash joins, temporary tables)
- **Formula**: `(Total RAM - shared_buffers) / (max_connections * 3)`
- **Impact**: Prevents disk-based sorts for complex queries
- **Warning**: Total memory usage = `work_mem * max_connections * 3`

**Recommendations by query complexity:**
- Simple queries: 4-8MB
- **Moderate queries (default): 16MB**
- Complex reports/analytics: 32-64MB
- Very large aggregations: 128-256MB

#### 4. `maintenance_work_mem` (Default: 128MB)
- **Purpose**: RAM for VACUUM, CREATE INDEX, ALTER TABLE operations
- **Recommendation**: 5-10% of system RAM
- **Impact**: Faster index creation and maintenance

**System RAM recommendations:**
- 2GB RAM: 64MB
- 4GB RAM: 128-256MB
- 8GB RAM: 512MB
- 16GB+ RAM: 1-2GB

### Connection Management

#### 5. `max_connections` (Default: 100)
- **Purpose**: Maximum concurrent database connections
- **Recommendation**: Match your application's connection pool size
- **Impact**: Each connection uses RAM (work_mem)

**Application type recommendations:**
- Small apps (<10 users): 20-50
- Medium apps (10-100 users): 50-100
- Large apps (100+ users): 100-200
- Very large apps: 200-500 (consider PgBouncer)

### Storage Performance

#### 6. `random_page_cost` (Default: 1.1)
- **Purpose**: Estimate of random disk access cost
- **SSD**: 1.0-1.1 (fast random access)
- **HDD**: 4.0 (slow random access)
- **Impact**: Query planner prefers index scans on SSD

#### 7. `effective_io_concurrency` (Default: 200)
- **Purpose**: Number of concurrent disk I/O operations
- **SSD**: 200-300
- **HDD**: 2-4
- **RAID**: Number of drives * base value
- **Impact**: Better parallel query performance

### Write-Ahead Logging (WAL)

#### 8. `wal_buffers` (Default: 16MB)
- **Purpose**: Buffer size for WAL before writing to disk
- **Recommendation**: -1 (auto-tune) or 16MB
- **Impact**: Reduces fsync calls for write-heavy workloads

#### 9. `min_wal_size` / `max_wal_size` (Default: 1GB / 4GB)
- **Purpose**: WAL file recycling thresholds
- **Recommendation**:
  - `min_wal_size`: 1-2GB
  - `max_wal_size`: 4-8GB
- **Impact**: Fewer checkpoint interruptions

#### 10. `checkpoint_completion_target` (Default: 0.9)
- **Purpose**: Spread checkpoint I/O over time (0.0-1.0)
- **Recommendation**: 0.7-0.9 (higher = smoother)
- **Impact**: Reduces I/O spikes during checkpoints

#### 11. `synchronous_commit` (Default: off)
- **Purpose**: Wait for WAL to be written to disk
- **Settings**:
  - `on`: Maximum durability (slower writes)
  - `off`: Fast writes, small data loss risk on crash
  - `local`: Good balance
- **Impact**: Significant write performance improvement
- **Warning**: Setting to `off` risks losing last few transactions on crash

### Query Optimization

#### 12. `default_statistics_target` (Default: 100)
- **Purpose**: Detail level for query planner statistics
- **Range**: 10-1000 (higher = better plans, slower ANALYZE)
- **Recommendation**: 100-250 for complex queries
- **Impact**: More accurate query plans

#### 13. `log_min_duration_statement` (Default: 5000ms production, 3000ms dev)
- **Purpose**: Log queries slower than this threshold
- **Recommendation**:
  - Development: 1000-3000ms
  - Production: 3000-5000ms
- **Impact**: Identify slow queries for optimization

### Additional Optimizations

#### 14. `wal_compression` (Default: on)
- **Purpose**: Compress WAL records
- **Impact**: Reduced WAL size, better I/O on write-heavy workloads

#### 15. `checkpoint_timeout` (Default: 15min)
- **Purpose**: Maximum time between automatic checkpoints
- **Impact**: Fewer checkpoint interruptions

#### 16. `shm_size` (Default: 256mb)
- **Purpose**: Shared memory size for Docker container
- **Recommendation**: At least equal to `shared_buffers`
- **Impact**: Required for PostgreSQL to function properly

## Monitoring and Logging

The configuration includes comprehensive logging:

```sql
log_checkpoints=on          -- Log checkpoint activity
log_connections=on          -- Log new connections
log_disconnections=on       -- Log disconnections
log_lock_waits=on          -- Log lock waits
log_temp_files=0           -- Log temporary file usage
log_min_duration_statement -- Log slow queries
```

### View PostgreSQL Logs

```bash
# View all logs
docker logs rgp-db

# Follow logs in real-time
docker logs -f rgp-db

# View only slow queries
docker logs rgp-db 2>&1 | grep "duration:"
```

### Monitor Query Performance

```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slowest queries
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

## System-Specific Recommendations

### For 8GB RAM System (Recommended for Production)

Update `.env`:
```env
PG_SHARED_BUFFERS=2GB
PG_EFFECTIVE_CACHE_SIZE=6GB
PG_WORK_MEM=32MB
PG_MAINTENANCE_WORK_MEM=512MB
PG_MAX_CONNECTIONS=100
```

### For 16GB RAM System (High Performance)

Update `.env`:
```env
PG_SHARED_BUFFERS=4GB
PG_EFFECTIVE_CACHE_SIZE=12GB
PG_WORK_MEM=64MB
PG_MAINTENANCE_WORK_MEM=1GB
PG_MAX_CONNECTIONS=100
```

### For 2GB RAM System (Minimal Setup)

Update `.env`:
```env
PG_SHARED_BUFFERS=128MB
PG_EFFECTIVE_CACHE_SIZE=512MB
PG_WORK_MEM=4MB
PG_MAINTENANCE_WORK_MEM=64MB
PG_MAX_CONNECTIONS=50
```

## View Query Performance

For slow queries (taking 6+ seconds), you need to investigate specifically which queries are slow.

### Check Current Settings

```bash
# Connect to PostgreSQL
docker exec -it rgp-db psql -U postgres -d rgpdb

# View current settings
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW work_mem;
SHOW maintenance_work_mem;
```

### Analyze Slow Queries

```sql
-- Find slow queries in logs
SELECT * FROM pg_stat_activity
WHERE state = 'active'
AND query_start < NOW() - INTERVAL '5 seconds';

-- Analyze a specific query
EXPLAIN ANALYZE
SELECT x.yr, x.mon, sum(x.total) as total, count(*)
FROM (
    SELECT date_part('year',s.bill_date) as yr,
           date_part('month',s.bill_date) as mon,
           s.id, s.total
    FROM sale s
    WHERE s.status = 'COMPLETE'
      AND s.customer_id = 1
      AND s.bill_date BETWEEN (current_date - interval '1 day' * 1095)
                          AND current_date
) x
GROUP BY x.yr, x.mon
ORDER BY x.yr DESC, x.mon DESC;
```

## Database Maintenance

### Regular Maintenance Tasks

```sql
-- Analyze tables for better query plans
ANALYZE;

-- Vacuum to reclaim space and update statistics
VACUUM ANALYZE;

-- Reindex to rebuild corrupted indexes
REINDEX DATABASE rgpdb;
```

### Automated Maintenance (Autovacuum)

PostgreSQL's autovacuum is enabled by default. Monitor it:

```sql
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;
```

## Performance Checklist for View Queries

If view queries are taking 6+ seconds:

1. **Add Indexes**: Check if views are missing indexes
   ```sql
   -- Find missing indexes
   SELECT * FROM pg_stat_user_tables WHERE idx_scan = 0 AND seq_scan > 0;
   ```

2. **Materialize Views**: Convert slow views to materialized views
   ```sql
   CREATE MATERIALIZED VIEW customer_sale_summary AS
   SELECT customer_id, SUM(total) as total_sales, COUNT(*) as order_count
   FROM sale
   WHERE status = 'COMPLETE'
   GROUP BY customer_id;

   -- Refresh periodically
   REFRESH MATERIALIZED VIEW customer_sale_summary;
   ```

3. **Increase `work_mem`**: For complex aggregations
   ```sql
   -- Per-session increase
   SET work_mem = '64MB';
   ```

4. **Check Query Plans**: Use EXPLAIN ANALYZE
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM your_view WHERE condition;
   ```

5. **Update Statistics**: Ensure planner has recent data
   ```sql
   ANALYZE VERBOSE your_table;
   ```

## Apply Configuration

After updating `.env` or docker-compose files:

```bash
# For production
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# For development
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

## Verify Configuration

```bash
# Check PostgreSQL logs for startup parameters
docker logs rgp-db 2>&1 | grep "shared_buffers"
docker logs rgp-db 2>&1 | grep "effective_cache_size"

# Or connect and check
docker exec -it rgp-db psql -U postgres -d rgpdb -c "SHOW ALL;" | grep -E "shared_buffers|work_mem|effective_cache"
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs rgp-db

# Common issue: shm_size too small
# Increase in docker-compose.yml: shm_size: 512mb
```

### Out of Memory Errors

```bash
# Reduce shared_buffers or work_mem
# Monitor container memory usage
docker stats rgp-db
```

### Slow Performance After Changes

```bash
# Restart PostgreSQL
docker-compose restart postgres

# Clear query cache
docker exec -it rgp-db psql -U postgres -d rgpdb -c "DISCARD ALL;"
```

## Additional Resources

- [PostgreSQL Tuning Guide](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [PgTune Configuration Calculator](https://pgtune.leopard.in.ua/)
- [PostgreSQL Performance Optimization](https://www.postgresql.org/docs/current/performance-tips.html)
