-- ============================================================================
-- Pre-Deployment Analysis Script
-- Run this BEFORE deploying 003_add_performance_indexes.sql
-- Save the output to compare with post-deployment performance
-- ============================================================================

\echo '========================================'
\echo 'DATABASE SIZE AND TABLE STATISTICS'
\echo '========================================'

-- Database size
SELECT
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value;

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    pg_stat_get_live_tuples(c.oid) AS row_count
FROM pg_tables
JOIN pg_class c ON c.relname = tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

\echo ''
\echo '========================================'
\echo 'CURRENT INDEX COUNT'
\echo '========================================'

-- Count existing indexes
SELECT
    'Total Indexes' as metric,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public';

-- Indexes per table
SELECT
    tablename,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY COUNT(*) DESC;

\echo ''
\echo '========================================'
\echo 'BASELINE QUERY PERFORMANCE TESTS'
\echo '========================================'

\echo 'Test 1: Sale Customer Lookup'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM sale
WHERE customer_id = (SELECT id FROM customer LIMIT 1)
    AND active = true
ORDER BY bill_date DESC
LIMIT 10;
\timing off

\echo ''
\echo 'Test 2: Sale Status Filter'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(*) FROM sale
WHERE status = 'COMPLETE'
    AND active = true;
\timing off

\echo ''
\echo 'Test 3: Inventory View Query'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM inventory_view
LIMIT 100;
\timing off

\echo ''
\echo 'Test 4: Product Search'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM product
WHERE active = true
    AND title ILIKE 'a%'
LIMIT 10;
\timing off

\echo ''
\echo 'Test 5: Purchase Invoice Items by Product'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM purchase_invoice_item
WHERE product_id = (SELECT id FROM product LIMIT 1)
    AND status = 'VERIFIED'
    AND active = true;
\timing off

\echo ''
\echo 'Test 6: Sale Items Join'
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
\echo 'Test 7: Customer Transaction History'
\timing on
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM customer_transaction
WHERE customer_id = (SELECT id FROM customer LIMIT 1)
ORDER BY trans_date DESC
LIMIT 20;
\timing off

\echo ''
\echo '========================================'
\echo 'TABLE STATISTICS'
\echo '========================================'

-- Row counts for major tables
SELECT
    'sale' as table_name,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE active = true) as active_rows,
    COUNT(*) FILTER (WHERE archive = true) as archived_rows
FROM sale
UNION ALL
SELECT
    'sale_item',
    COUNT(*),
    COUNT(*) FILTER (WHERE active = true),
    COUNT(*) FILTER (WHERE archive = true)
FROM sale_item
UNION ALL
SELECT
    'purchase_invoice',
    COUNT(*),
    COUNT(*) FILTER (WHERE active = true),
    COUNT(*) FILTER (WHERE archive = true)
FROM purchase_invoice
UNION ALL
SELECT
    'purchase_invoice_item',
    COUNT(*),
    COUNT(*) FILTER (WHERE active = true),
    COUNT(*) FILTER (WHERE archive = true)
FROM purchase_invoice_item
UNION ALL
SELECT
    'product',
    COUNT(*),
    COUNT(*) FILTER (WHERE active = true),
    COUNT(*) FILTER (WHERE archive = true)
FROM product
UNION ALL
SELECT
    'customer',
    COUNT(*),
    COUNT(*) FILTER (WHERE active = true),
    COUNT(*) FILTER (WHERE archive = true)
FROM customer;

\echo ''
\echo '========================================'
\echo 'MOST FREQUENT STATUS VALUES'
\echo '========================================'

-- Sale status distribution
SELECT
    'sale' as table_name,
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM sale
WHERE active = true
GROUP BY status
ORDER BY count DESC;

-- Sale item status distribution
SELECT
    'sale_item' as table_name,
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM sale_item
WHERE active = true
GROUP BY status
ORDER BY count DESC;

-- Purchase invoice item status distribution
SELECT
    'purchase_invoice_item' as table_name,
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM purchase_invoice_item
WHERE active = true
GROUP BY status
ORDER BY count DESC;

\echo ''
\echo '========================================'
\echo 'SEQUENTIAL SCAN STATISTICS'
\echo '========================================'

-- Tables with high sequential scan counts
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
    END as seq_scan_percentage
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;

\echo ''
\echo '========================================'
\echo 'CACHE HIT RATIO'
\echo '========================================'

-- Buffer cache hit ratio (should be > 95%)
SELECT
    'Buffer Cache Hit Ratio' as metric,
    ROUND(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) || '%' as value
FROM pg_statio_user_tables;

\echo ''
\echo '========================================'
\echo 'ACTIVE CONNECTIONS'
\echo '========================================'

SELECT
    state,
    COUNT(*) as connection_count
FROM pg_stat_activity
GROUP BY state
ORDER BY COUNT(*) DESC;

\echo ''
\echo '========================================'
\echo 'VACUUM AND ANALYZE STATUS'
\echo '========================================'

SELECT
    schemaname,
    relname as table_name,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    n_dead_tup as dead_tuples,
    n_live_tup as live_tuples
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_live_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 15;

\echo ''
\echo '========================================'
\echo 'PRE-DEPLOYMENT ANALYSIS COMPLETE'
\echo 'Save this output for comparison'
\echo '========================================'

-- Save current timestamp
SELECT
    'Analysis completed at: ' || NOW()::TEXT as info;

-- Recommendations for deployment
\echo ''
\echo 'RECOMMENDATIONS:'
\echo '1. If dead_tuples is high, run VACUUM ANALYZE before deployment'
\echo '2. If buffer cache hit ratio < 95%, consider increasing shared_buffers'
\echo '3. Note the sequential scan counts for comparison after deployment'
\echo '4. Save this output to compare with post-deployment results'
