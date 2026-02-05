# Railway Deployment - Quick Start Guide

Fast-track guide to deploy RGP Back Office to Railway in under 30 minutes.

---

## Prerequisites Checklist

- [ ] Railway account ([sign up free](https://railway.app))
- [ ] Code pushed to GitHub
- [ ] `psql` installed locally for database setup

---

## Quick Deploy Steps

### 1. Create Project (2 minutes)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create project
railway init --name rgp-back-office
```

### 2. Add Databases (3 minutes)

**In Railway Dashboard:**

1. Click **New** → **Database** → **PostgreSQL**
2. Click **New** → **Database** → **Redis**
3. Note the PostgreSQL `DATABASE_URL` from Variables tab

### 3. Initialize Database (5 minutes)

```bash
# Set DATABASE_URL from Railway
export DATABASE_URL="[paste-from-railway]"

# Run setup script
bash railway-setup.sh

# Or manually:
psql "$DATABASE_URL" -f sql/ddl/tables.sql
psql "$DATABASE_URL" -f sql/ddl/sequences.sql
psql "$DATABASE_URL" -f sql/ddl/functions.sql
psql "$DATABASE_URL" -f sql/ddl/views.sql
psql "$DATABASE_URL" -f sql/init.sql
```

### 4. Deploy Backend API (5 minutes)

**In Railway Dashboard:**

1. Click **New** → **GitHub Repo** → Select `rgp-bo`
2. **Settings**:
   - Root Directory: `api-v2`
   - Service Name: `rgp-api`
3. **Variables** (click service → Variables):
   ```bash
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_HOST=${{Redis.REDIS_HOST}}
   REDIS_PORT=${{Redis.REDIS_PORT}}
   JWT_KEY=[generate-random-64-char-string]
   JWT_EXPIRES=24h
   FILEUPLOAD_LOCATION=/app/uploads
   FILEUPLOAD_SIZE_LIMIT=10485760
   LOG_SQL=false
   ```
4. **Settings** → **Volumes** → **New Volume**:
   - Mount Path: `/app/uploads`
   - Size: 1GB
5. Click **Deploy**

**Generate JWT_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Get API URL:**
After deployment completes, click service → **Settings** → **Networking** → Copy the public URL

### 5. Deploy Frontend (5 minutes)

**In Railway Dashboard:**

1. Click **New** → **GitHub Repo** → Select `rgp-bo`
2. **Settings**:
   - Root Directory: `frontend`
   - Service Name: `rgp-frontend`
3. **Variables**:
   ```bash
   API_URL=https://[your-backend-url].up.railway.app
   ```
4. Click **Deploy**

### 6. Configure CORS (2 minutes)

1. Go to backend service → **Variables**
2. Add:
   ```bash
   CORS_ORIGINS=https://[your-frontend-url].up.railway.app,http://localhost:4200
   ```
3. Redeploy backend (automatic or click Redeploy)

### 7. Test Deployment (5 minutes)

1. Open frontend URL: `https://[your-frontend].up.railway.app`
2. Login:
   - Email: `admin@rgp.com`
   - Password: `admin123`
3. Test navigation:
   - Dashboard
   - Sales
   - Products
   - Customers

---

## Verify Everything Works

### Backend Health Check
```bash
curl https://[your-backend].up.railway.app/health
```

### API Login Test
```bash
curl -X POST https://[your-backend].up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rgp.com","password":"admin123"}'
```

### Swagger Documentation
Open: `https://[your-backend].up.railway.app/api`

---

## Post-Deployment Tasks

### Security (CRITICAL)

1. **Change admin password:**
   ```bash
   # Generate hash
   cd util
   node password-util.js hash YourNewPassword123

   # Update in database
   psql "$DATABASE_URL"
   UPDATE app_user SET password='[new-hash]' WHERE email='admin@rgp.com';
   ```

2. **Verify JWT_KEY is random** (not "dev")

3. **Verify DATABASE_URL** doesn't use default password

### Monitoring

1. Check Railway metrics:
   - Each service → **Metrics** tab
   - Monitor CPU, Memory, Network

2. Check logs:
   - Each service → **Logs** tab
   - Look for errors

---

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
railway logs --service rgp-api

# Common issues:
# - DATABASE_URL not set correctly
# - REDIS_HOST not set correctly
# - Build failed (Python/pdfplumber issue)
```

### Frontend Shows 404
```bash
# Check logs
railway logs --service rgp-frontend

# Common issues:
# - Build failed (Node version, npm install)
# - nginx.conf not copied correctly
```

### CORS Errors
- Verify CORS_ORIGINS includes frontend URL
- Check browser console for exact error
- Ensure no typos in URLs

### Database Connection Fails
```bash
# Test connection locally
psql "$DATABASE_URL" -c "SELECT version();"

# Verify Railway Postgres service is running
railway status
```

---

## Railway CLI Quick Reference

```bash
# View all services
railway status

# View logs
railway logs --service rgp-api
railway logs --service rgp-frontend

# Set environment variable
railway variables set KEY=value --service rgp-api

# Connect to database
railway connect postgres

# Open service in browser
railway open
```

---

## Cost Estimate

**Developer Plan ($20/month):**
- PostgreSQL: ~$5-8
- Redis: ~$2-5
- API Backend: ~$5-10
- Frontend: ~$2-5
- **Total: ~$14-28/month**

---

## Next Steps

1. ✅ Deployment complete
2. [ ] Change admin password
3. [ ] Update JWT secret
4. [ ] Configure custom domain (optional)
5. [ ] Set up monitoring/alerts
6. [ ] Configure backups
7. [ ] Load test application

---

## Full Documentation

For detailed information, see: [`docs/RAILWAY_DEPLOYMENT_GUIDE.md`](./RAILWAY_DEPLOYMENT_GUIDE.md)

---

## Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Project Issues**: Create GitHub issue

---

**Deployment Time**: ~30 minutes
**Last Updated**: 2026-02-04
