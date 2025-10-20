-- ============================================================================
-- Post-Deployment Analysis Script
-- Run this AFTER deploying 003_add_performance_indexes.sql
-- Compare results with pre-deployment analysis
-- ============================================================================

\echo '========================================'
\echo 'POST-DEPLOYMENT INDEX VERIFICATION'
\echo '========================================'

-- Count new indexes
SELECT
    'Total Indexes' as metric,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public';

-- New indexes created
SELECT
    'New Indexes (idx_*)' as metric,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

-- Indexes per table (after deployment)
SELECT
    tablename,
    COUNT(*) as index_count,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY COUNT(*) DESC
LIMIT 20;

\echo ''
\echo '========================================'
\echo 'INDEX DETAILS BY TABLE'
\echo '========================================'

-- Sale table indexes
SELECT
    'sale' as table_name,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
    AND tablename = 'sale'
ORDER BY indexname;

-- Sale_item table indexes
SELECT
    'sale_item' as table_name,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
    AND tablename = 'sale_item'
ORDER BY indexname;

-- Purchase_invoice_item table indexes
SELECT
    'purchase_invoice_item' as table_name,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
    AND tablename = 'purchase_invoice_item'
ORDER BY indexname;

-- Product table indexes
SELECT
    'product' as table_name,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
    AND tablename = 'product'
ORDER BY indexname;

\echo ''
\echo '========================================'
\echo 'STORAGE IMPACT ANALYSIS'
\echo '========================================'

-- Database size after indexes
SELECT
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value;

-- Table sizes with index overhead
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    ROUND(100.0 * (pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) /
          NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0), 2) as index_percentage
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

\echo ''
\echo '========================================'
\echo 'QUERY PERFORMANCE TESTS (COMPARE WITH PRE-DEPLOYMENT)'
\echo '========================================'

\echo 'Test 1: Sale Customer Lookup (should use idx_sale_customer_id)'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM sale
WHERE customer_id = (SELECT id FROM customer LIMIT 1)
    AND active = true
ORDER BY bill_date DESC
LIMIT 10;
\timing off

\echo ''
\echo 'Test 2: Sale Status Filter (should use idx_sale_status)'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(*) FROM sale
WHERE status = 'COMPLETE'
    AND active = true;
\timing off

\echo ''
\echo 'Test 3: Inventory View Query (should use multiple indexes)'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM inventory_view
LIMIT 100;
\timing off

\echo ''
\echo 'Test 4: Product Search (should use idx_product_title or idx_product_title_trgm)'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM product
WHERE active = true
    AND title ILIKE 'a%'
LIMIT 10;
\timing off

\echo ''
\echo 'Test 5: Purchase Invoice Items (should use idx_purchase_invoice_item_verified)'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM purchase_invoice_item
WHERE product_id = (SELECT id FROM product LIMIT 1)
    AND status = 'VERIFIED'
    AND active = true;
\timing off

\echo ''
\echo 'Test 6: Sale Items Join (should use idx_sale_item_product_id)'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT si.*, p.title
FROM sale_item si
JOIN product p ON p.id = si.product_id
WHERE si.status = 'Complete'
    AND si.active = true
LIMIT 100;
\timing off

\echo ''
\echo 'Test 7: Customer Transaction History (should use idx_customer_transaction_customer_id)'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM customer_transaction
WHERE customer_id = (SELECT id FROM customer LIMIT 1)
ORDER BY trans_date DESC
LIMIT 20;
\timing off

\echo ''
\echo '========================================'
\echo 'INDEX USAGE STATISTICS'
\echo '========================================'

-- Index scan statistics (run after some usage)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 30;

\echo ''
\echo '========================================'
\echo 'POTENTIALLY UNUSED INDEXES'
\echo '(Check after 24-48 hours of production use)'
\echo '========================================'

SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as size,
    'Consider reviewing if scans = 0 after 1 week' as note
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

\echo ''
\echo '========================================'
\echo 'SEQUENTIAL SCAN COMPARISON'
\echo '========================================'

-- Sequential scans should be lower than pre-deployment
SELECT
    schemaname,
    relname as table_name,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE
        WHEN seq_scan + idx_scan = 0 THEN 0
        ELSE ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 2)
    END as seq_scan_percentage,
    CASE
        WHEN seq_scan + idx_scan = 0 THEN 'N/A'
        WHEN seq_scan > idx_scan THEN 'WARNING: More seq scans than index scans'
        ELSE 'OK: More index scans'
    END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;

\echo ''
\echo '========================================'
\echo 'CACHE HIT RATIO (AFTER INDEXES)'
\echo '========================================'

-- Buffer cache hit ratio (should remain > 95%)
SELECT
    'Buffer Cache Hit Ratio' as metric,
    ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) || '%' as value,
    CASE
        WHEN ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) >= 95 THEN 'GOOD'
        WHEN ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) >= 90 THEN 'ACCEPTABLE'
        ELSE 'WARNING: Consider increasing shared_buffers'
    END as status
FROM pg_statio_user_tables;

\echo ''
\echo '========================================'
\echo 'INDEX BLOAT CHECK'
\echo '========================================'

-- Check for index bloat
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED - Consider dropping'
        WHEN idx_scan < 100 THEN 'LOW USAGE - Monitor'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

\echo ''
\echo '========================================'
\echo 'INVALID INDEXES CHECK'
\echo '========================================'

-- Check for invalid indexes (from failed CONCURRENT builds)
SELECT
    schemaname,
    tablename,
    indexname,
    'INVALID - Should be dropped and recreated' as status
FROM pg_indexes
JOIN pg_index ON pg_index.indexrelid = (schemaname||'.'||indexname)::regclass
WHERE schemaname = 'public'
    AND NOT indisvalid;

-- If any invalid indexes found:
\echo 'To drop invalid indexes, use:'
\echo 'DROP INDEX CONCURRENTLY index_name;'

\echo ''
\echo '========================================'
\echo 'INDEX MAINTENANCE RECOMMENDATIONS'
\echo '========================================'

-- Tables that need VACUUM
SELECT
    schemaname,
    relname as table_name,
    n_dead_tup as dead_tuples,
    n_live_tup as live_tuples,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) as dead_percentage,
    CASE
        WHEN n_dead_tup > n_live_tup * 0.2 THEN 'VACUUM RECOMMENDED'
        WHEN n_dead_tup > n_live_tup * 0.1 THEN 'VACUUM SUGGESTED'
        ELSE 'OK'
    END as recommendation,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_live_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 15;

\echo ''
\echo '========================================'
\echo 'QUERY PLANNER STATISTICS'
\echo '========================================'

-- Check statistics targets for major tables
SELECT
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    null_frac,
    avg_width,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
    AND tablename IN ('sale', 'sale_item', 'purchase_invoice_item', 'product')
    AND attname IN ('customer_id', 'product_id', 'status', 'active')
ORDER BY tablename, attname;

\echo ''
\echo '========================================'
\echo 'PERFORMANCE SUMMARY'
\echo '========================================'

WITH index_stats AS (
    SELECT
        COUNT(*) as total_indexes,
        COUNT(*) FILTER (WHERE indexname LIKE 'idx_%') as new_indexes,
        SUM(pg_relation_size(indexrelid)) as total_index_size,
        SUM(idx_scan) as total_scans
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
)
SELECT
    total_indexes || ' total indexes' as metric_1,
    new_indexes || ' performance indexes added' as metric_2,
    pg_size_pretty(total_index_size) || ' total index size' as metric_3,
    total_scans || ' total index scans' as metric_4
FROM index_stats;

\echo ''
\echo '========================================'
\echo 'NEXT STEPS'
\echo '========================================'

\echo '1. Compare query execution times with pre-deployment results'
\echo '2. Monitor index usage over next 24-48 hours'
\echo '3. Run ANALYZE on major tables if needed'
\echo '4. Check application logs for improved response times'
\echo '5. Review "potentially unused indexes" after 1 week'
\echo '6. Schedule regular index maintenance (REINDEX if needed)'
\echo ''
\echo 'To monitor index usage in real-time:'
\echo 'SELECT * FROM pg_stat_user_indexes WHERE indexname LIKE ''idx_%'' ORDER BY idx_scan DESC;'
\echo ''

-- Save timestamp
SELECT
    'Post-deployment analysis completed at: ' || NOW()::TEXT as info;

\echo ''
\echo '========================================'
\echo 'POST-DEPLOYMENT ANALYSIS COMPLETE'
\echo '========================================'
