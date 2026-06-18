# Railway Production Runbook

This runbook is for moving the current shop desktop deployment to Railway while the production database currently runs on a VPS.

## Target Services

Deploy four Railway services:

- PostgreSQL
- Redis
- API from `api-v2`
- Frontend from `frontend`

## Database Migration Path

Do not initialize Railway production from scattered local setup scripts if you already have production data on the VPS. Use a database dump from the VPS database and restore it into Railway PostgreSQL.

1. Create a VPS database dump:

   ```bash
   pg_dump "$VPS_DATABASE_URL" > rgp-prod-vps.dump.sql
   ```

2. Restore into Railway PostgreSQL:

   ```bash
   psql "$RAILWAY_DATABASE_URL" < rgp-prod-vps.dump.sql
   ```

3. Apply only known missing migrations after checking the restored schema. For existing deployments, prefer:

   ```bash
   node railway-apply-missing-migrations.js "$RAILWAY_DATABASE_URL"
   ```

4. Apply the metrics worker schema if you want metrics collection on Railway:

   ```bash
   DATABASE_URL="$RAILWAY_DATABASE_URL" npm run metrics:migrate
   ```

## API Service

Railway service root: `api-v2`

Required variables:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SSL=true
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
JWT_KEY=<secure random string>
JWT_EXPIRES=24h
FILEUPLOAD_LOCATION=/app/uploads
FILEUPLOAD_SIZE_LIMIT=10485760
DB_BACKUP_CRON_ENABLED=false
LOG_SQL=false
CORS_ORIGINS=https://<frontend-domain>
```

Optional variables:

```bash
ANTHROPIC_API_KEY=<only if OCR/AI features are used>
GITHUB_TOKEN=<only if bug-report GitHub integration is used>
GITHUB_OWNER=<repo-owner>
GITHUB_REPO=<repo-name>
```

Create a Railway volume mounted at:

```bash
/app/uploads
```

Verify:

```bash
curl https://<api-domain>/health
```

## Frontend Service

Railway service root: `frontend`

The service uses `Dockerfile.prod` through `frontend/railway.toml`.

Set:

```bash
API_URL=https://<api-domain>
```

Verify the built frontend points to the public API URL, then update API `CORS_ORIGINS` with the final frontend domain.

## Metrics Worker

The metrics worker can be run as a separate Railway service or manually as a scheduled command.

For a service, use root directory:

```bash
metrics-worker
```

Start command:

```bash
npm run worker
```

Variables:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
PGSSL=true
METRICS_INTERVAL_SECONDS=900
METRICS_WINDOW_MINUTES=60
METRICS_REPORT_DIR=/app/reports
```

Run once after deployment:

```bash
npm run metrics:once
```

## Production Checks

- Rotate any secrets that were ever committed or pasted into local `.env` files.
- Change the default admin password.
- Verify login from frontend.
- Verify products, sales, purchases, and file upload.
- Verify API logs have no database SSL, Redis, or CORS errors.
- Verify `metric_run` records are created if metrics worker is enabled.
