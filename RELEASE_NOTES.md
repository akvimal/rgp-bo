# Release Notes

## v2.1.0 — 2026-08-09

### Fixes

- **Stock/sales listings hid soon-to-expire but still-sellable batches.** Store and sale-item lookups excluded any batch within 30 days of its `exp_date`, so still-in-stock products (e.g. FEMAFORD 2.5MG TAB 10'S) disappeared from search well before actually expiring. The 30-day buffer is now controlled by `EXPIRY_THRESHOLD_DAYS` (default and minimum `0`, i.e. only truly expired batches are excluded). Set it to a positive number of days to restore a pre-expiry buffer if desired.
- **Dashboard "Sales Trend" chart showed dates out of order.** The daily-frequency sales-by-date query had no `ORDER BY`, so Postgres could return grouped rows in an arbitrary order, making the chart's x-axis appear jumbled. The query now orders by bill date, matching the existing monthly-frequency query and the (already-correct) customer-visit-trend queries.

### Configuration changes

- New environment variable `EXPIRY_THRESHOLD_DAYS` (default `0`) added to `.env.example` and the `api` service in `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-compose.prod.yml`.

### Included branches

- `fix/configurable-expiry-threshold`
- `fix/sales-trend-daily-order`
