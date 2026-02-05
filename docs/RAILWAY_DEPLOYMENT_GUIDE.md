# Railway Deployment Guide - RGP Back Office

Complete guide for deploying the RGP Back Office application to Railway.app

---

## Overview

This guide covers deploying a 4-service application to Railway:
1. **PostgreSQL Database** (managed service)
2. **Redis Cache** (managed service)
3. **NestJS Backend API** (containerized)
4. **Angular Frontend** (containerized)

**Estimated Time**: 30-45 minutes
**Estimated Cost**: $14-30/month (Developer Plan)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Railway account ([railway.app](https://railway.app))
- [ ] GitHub repository with this code
- [ ] Railway CLI installed (optional): `npm i -g @railway/cli`
- [ ] PostgreSQL client (`psql`) for database initialization
- [ ] Admin access to update environment variables

---

## Step 1: Create Railway Project

### Via Railway Dashboard

1. Go to [railway.app](https://railway.app) and login
2. Click **"New Project"**
3. Select **"Empty Project"**
4. Name it: `rgp-back-office`

### Via Railway CLI

```bash
# Login to Railway
railway login

# Create new project
railway init --name rgp-back-office
```

---

## Step 2: Deploy PostgreSQL Database

### Add PostgreSQL Service

1. In your Railway project, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway will provision a PostgreSQL 17 instance
3. Click on the PostgreSQL service to view connection details

### Note Connection Details

Railway provides these environment variables automatically:
```
DATABASE_URL=postgresql://postgres:[password]@[host].railway.app:[port]/railway
PGHOST=[host].railway.app
PGPORT=[port]
PGUSER=postgres
PGPASSWORD=[password]
PGDATABASE=railway
```

**Save these for later use.**

### Initialize Database Schema

You have two options:

#### Option A: Using Railway Web Console

1. Click on PostgreSQL service → **"Data"** tab → **"Query"**
2. Copy and paste contents of each SQL file in order:
   - `sql/ddl/tables.sql`
   - `sql/ddl/sequences.sql`
   - `sql/ddl/functions.sql`
   - `sql/ddl/views.sql`
   - `sql/init.sql`
   - `sql/migrations/002_fix_bill_number_race_condition.sql`
   - `sql/migrations/003_hr_management_tables.sql`
   - `sql/migrations/004_setup_test_db.sql`
   - `sql/migrations/005_update_hr_permissions.sql`

#### Option B: Using Setup Script (Recommended)

```bash
# Set DATABASE_URL from Railway
export DATABASE_URL="postgresql://postgres:[password]@[host].railway.app:[port]/railway"

# Run setup script
bash railway-setup.sh

# Windows users
set DATABASE_URL=postgresql://postgres:[password]@[host].railway.app:[port]/railway
railway-setup.bat
```

### Verify Database Setup

```bash
# Connect to Railway database
psql "$DATABASE_URL"

# Check tables
\dt

# Verify admin user exists
SELECT id, email, full_name FROM app_user WHERE email = 'admin@rgp.com';

# Should show: id: 1, email: admin@rgp.com, full_name: RGP Admin
```

---

## Step 3: Deploy Redis Cache

### Add Redis Service

1. In your Railway project, click **"New"** → **"Database"** → **"Redis"**
2. Railway will provision a Redis instance
3. Note the internal connection details:

```
REDIS_HOST=[service-name].railway.internal
REDIS_PORT=6379
```

### Configure Redis

1. Click on Redis service → **"Variables"**
2. Add configuration:
   ```
   REDIS_MAXMEMORY=256mb
   REDIS_MAXMEMORY_POLICY=allkeys-lru
   ```

---

## Step 4: Deploy Backend API

### Add Backend Service

1. Click **"New"** → **"GitHub Repo"**
2. Select your repository: `rgp-bo`
3. Railway will detect it's a monorepo

### Configure Backend Service

1. Click on the new service → **"Settings"**
2. Set **Root Directory**: `api-v2`
3. Set **Service Name**: `rgp-api`

### Set Environment Variables

Click on the service → **"Variables"** → Add these:

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database (reference PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (reference Redis service)
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}

# JWT Configuration (CHANGE THESE!)
JWT_KEY=YOUR_SECURE_RANDOM_STRING_HERE_CHANGE_ME
JWT_EXPIRES=24h

# File Upload
FILEUPLOAD_LOCATION=/app/uploads
FILEUPLOAD_SIZE_LIMIT=10485760

# Optional
LOG_SQL=false
ANTHROPIC_API_KEY=your_anthropic_key_if_using_ai_features
```

**⚠️ IMPORTANT**: Replace `JWT_KEY` with a secure random string:
```bash
# Generate secure JWT key
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Add Railway Volume for Uploads

1. Click on backend service → **"Settings"** → **"Volumes"**
2. Click **"New Volume"**
3. Configure:
   - **Mount Path**: `/app/uploads`
   - **Size**: 1GB (or as needed)
4. Click **"Add"**

### Deploy Backend

1. Click **"Deploy"** or push to GitHub (auto-deploys)
2. Monitor build logs in **"Deployments"** tab
3. Wait for deployment to complete (3-5 minutes)
4. Note the public URL: `https://[service-name].up.railway.app`

### Verify Backend Health

```bash
# Check health endpoint
curl https://[your-backend-url].up.railway.app/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Test API

```bash
# Test login
curl -X POST https://[your-backend-url].up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rgp.com","password":"admin123"}'

# Should return JWT token
```

---

## Step 5: Deploy Frontend

### Update Frontend Configuration

Before deploying, update the API URL in frontend:

1. Edit `frontend/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://[your-backend-url].up.railway.app'
};
```

2. Commit and push changes to GitHub

### Add Frontend Service

1. Click **"New"** → **"GitHub Repo"**
2. Select your repository: `rgp-bo`
3. Railway will detect the same repo

### Configure Frontend Service

1. Click on the new service → **"Settings"**
2. Set **Root Directory**: `frontend`
3. Set **Service Name**: `rgp-frontend`

### Set Environment Variables

Click on the service → **"Variables"** → Add:

```bash
# API Backend URL
API_URL=${{rgp-api.RAILWAY_PUBLIC_DOMAIN}}
```

### Deploy Frontend

1. Click **"Deploy"** or push to GitHub (auto-deploys)
2. Monitor build logs (Angular build takes 2-5 minutes)
3. Wait for deployment to complete
4. Note the public URL: `https://[frontend-name].up.railway.app`

### Generate Public Domain

1. Click on frontend service → **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. You'll get: `https://[random-name].up.railway.app`
4. Optional: Add custom domain

---

## Step 6: Configure CORS

Update backend CORS to allow frontend domain.

### Check Current CORS Configuration

Check `api-v2/src/main.ts`:

```typescript
app.enableCors({
  origin: [
    'http://localhost:4200',
    'http://localhost:8000',
    'https://[your-frontend-domain].up.railway.app' // Add this
  ],
  credentials: true
});
```

### Update CORS via Environment Variable (Better Approach)

1. Add to backend environment variables:
```bash
CORS_ORIGINS=https://[your-frontend-domain].up.railway.app,http://localhost:4200
```

2. Update `api-v2/src/main.ts` to use environment variable:
```typescript
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4200'];
app.enableCors({
  origin: corsOrigins,
  credentials: true
});
```

3. Commit, push, and redeploy

---

## Step 7: Verify Deployment

### Test Complete Flow

1. **Open Frontend**: `https://[your-frontend].up.railway.app`
2. **Login**:
   - Email: `admin@rgp.com`
   - Password: `admin123`
3. **Test Features**:
   - [ ] Dashboard loads
   - [ ] Navigate to Sales
   - [ ] Navigate to Products
   - [ ] Navigate to Customers
   - [ ] Upload a document (tests file upload)
   - [ ] Check Redis cache (should see performance improvement)

### Check Service Health

```bash
# Backend health
curl https://[your-backend].up.railway.app/health

# Frontend loads
curl -I https://[your-frontend].up.railway.app

# Swagger documentation
curl https://[your-backend].up.railway.app/api
```

### Monitor Logs

Railway provides real-time logs:
1. Click on each service
2. Go to **"Logs"** tab
3. Check for errors

---

## Step 8: Post-Deployment Configuration

### Security Checklist

- [ ] Change default admin password
- [ ] Update JWT_KEY to secure random string
- [ ] Remove default database credentials from code
- [ ] Enable HTTPS only (Railway provides this automatically)
- [ ] Configure CORS properly
- [ ] Set up environment-specific variables

### Monitoring Setup

1. **Railway Metrics**: Each service shows CPU, Memory, Network usage
2. **Custom Monitoring**: Add application-level logging
3. **Uptime Monitoring**: Use external service (UptimeRobot, etc.)

### Backup Strategy

1. **Database Backups**:
   - Railway provides automated daily backups
   - Manual backup:
     ```bash
     pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql
     ```

2. **File Uploads**:
   - Railway volumes are persistent
   - Consider cloud storage (S3, etc.) for production

### Update Admin Credentials

```sql
-- Connect to Railway database
psql "$DATABASE_URL"

-- Update admin password
UPDATE app_user
SET password = '[new-hashed-password]'
WHERE email = 'admin@rgp.com';
```

Generate new password hash:
```bash
cd util
node password-util.js hash YourNewSecurePassword123
```

---

## Troubleshooting

### Build Failures

**Frontend build fails:**
- Check Node version compatibility (requires Node 16+)
- Check for `package-lock.json` conflicts
- Try `npm install --legacy-peer-deps --force`

**Backend build fails:**
- Python installation issues (pdfplumber dependency)
- Check Dockerfile is using Alpine Linux correctly
- Verify `npm install --force` succeeds

### Runtime Errors

**Database connection fails:**
```bash
# Verify DATABASE_URL is set correctly
railway variables --service rgp-api

# Test connection
psql "$DATABASE_URL" -c "SELECT version();"
```

**Redis connection fails:**
```bash
# Verify Redis is running
railway status

# Check Redis host/port
railway variables --service rgp-api | grep REDIS
```

**CORS errors:**
- Verify frontend domain is in CORS_ORIGINS
- Check browser console for exact error
- Ensure credentials: true is set

**File upload fails:**
- Verify Railway volume is mounted at `/app/uploads`
- Check FILEUPLOAD_LOCATION environment variable
- Check volume permissions

### Performance Issues

**Slow response times:**
- Check Railway service metrics (CPU, Memory)
- Monitor Redis cache hit rate
- Review database query performance
- Consider upgrading Railway plan

**Out of memory:**
- Increase Railway service resources
- Optimize Redis memory policy
- Review application memory leaks

---

## Railway CLI Cheat Sheet

```bash
# Login
railway login

# Link to project
railway link

# Check status
railway status

# View logs
railway logs --service rgp-api

# Set environment variable
railway variables set JWT_KEY=your-secret-key --service rgp-api

# Get all variables
railway variables --service rgp-api

# Connect to PostgreSQL
railway connect postgres

# Connect to Redis
railway connect redis

# Deploy manually
railway up

# Open service in browser
railway open

# View service URL
railway domain
```

---

## Cost Optimization

### Railway Pricing Tiers

**Hobby Plan** (Free tier):
- $5 credit/month
- Good for testing only
- Services sleep after inactivity

**Developer Plan** ($20/month):
- Unlimited usage
- No sleep
- Estimated cost for this app: $14-30/month

**Pro Plan** ($50/month + usage):
- Production workloads
- Team collaboration
- Better performance

### Reduce Costs

1. **Optimize Docker Images**:
   - Use multi-stage builds
   - Remove dev dependencies in production
   - Use Alpine Linux (already doing this)

2. **Database Optimization**:
   - Regular VACUUM and ANALYZE
   - Index optimization
   - Archive old data

3. **Redis Optimization**:
   - Set appropriate maxmemory (currently 256MB)
   - Use LRU eviction policy (already configured)
   - Monitor cache hit rate

4. **Scale Appropriately**:
   - Start with smaller resources
   - Scale up based on actual usage
   - Use Railway metrics to guide decisions

---

## Next Steps

### After Successful Deployment

1. **Documentation**:
   - Update README.md with production URLs
   - Document deployment process for team
   - Create runbook for common operations

2. **CI/CD**:
   - Railway auto-deploys from GitHub
   - Configure branch-based environments
   - Add pre-deployment tests

3. **Monitoring**:
   - Set up error tracking (Sentry, etc.)
   - Configure uptime monitoring
   - Create alerting for critical issues

4. **Scaling**:
   - Monitor usage patterns
   - Plan for horizontal scaling if needed
   - Consider CDN for static assets

5. **Security Hardening**:
   - Regular dependency updates
   - Security scanning (Dependabot, Snyk)
   - Penetration testing
   - Regular backups and disaster recovery testing

---

## Support

### Railway Support
- Documentation: [docs.railway.app](https://docs.railway.app)
- Discord: [discord.gg/railway](https://discord.gg/railway)
- Status: [status.railway.app](https://status.railway.app)

### Project Support
- GitHub Issues: Create issue in repository
- Documentation: Check `/docs` folder
- Test Scripts: Run integration tests in `/tests`

---

## Rollback Procedure

If deployment fails or has issues:

### Quick Rollback via Railway Dashboard

1. Go to service → **"Deployments"**
2. Find last working deployment
3. Click **"Redeploy"**

### Database Rollback

```bash
# Restore from backup
psql "$DATABASE_URL" < backup-YYYYMMDD.sql

# Or use Railway's point-in-time recovery
# Contact Railway support for database restoration
```

### Full Rollback

```bash
# Revert git commit
git revert HEAD
git push

# Railway will auto-deploy previous version
```

---

## Appendix: Environment Variables Reference

### Backend API (api-v2)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| NODE_ENV | Yes | production | Node environment |
| PORT | Yes | 3000 | Server port |
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| REDIS_HOST | Yes | - | Redis host |
| REDIS_PORT | Yes | 6379 | Redis port |
| JWT_KEY | Yes | - | JWT secret key (MUST CHANGE) |
| JWT_EXPIRES | No | 24h | JWT expiration |
| FILEUPLOAD_LOCATION | Yes | /app/uploads | Upload directory |
| FILEUPLOAD_SIZE_LIMIT | No | 10485760 | Max file size (10MB) |
| LOG_SQL | No | false | Log SQL queries |
| ANTHROPIC_API_KEY | No | - | For AI features (OCR, etc.) |
| CORS_ORIGINS | No | - | Comma-separated allowed origins |

### Frontend (frontend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| API_URL | Yes | - | Backend API URL |

---

**Last Updated**: 2026-02-04
**Guide Version**: 1.0
**Tested On**: Railway.app (February 2026)
