# 🚀 Railway Deployment - RGP Back Office

> **Ready to Deploy**: This application is fully configured for Railway deployment.

---

## Quick Links

- **Quick Start** (30 min): [`docs/RAILWAY_QUICK_START.md`](docs/RAILWAY_QUICK_START.md)
- **Full Guide** (detailed): [`docs/RAILWAY_DEPLOYMENT_GUIDE.md`](docs/RAILWAY_DEPLOYMENT_GUIDE.md)
- **Deployment Checklist**: [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)
- **Summary**: [`docs/RAILWAY_DEPLOYMENT_SUMMARY.md`](docs/RAILWAY_DEPLOYMENT_SUMMARY.md)

---

## 30-Second Overview

**What is Railway?**
- Modern Platform-as-a-Service (PaaS)
- Deploy with GitHub integration
- Managed PostgreSQL + Redis
- Auto-scaling and monitoring
- Pay-as-you-go pricing

**Why Railway?**
- ✅ No server management
- ✅ One-click deployment
- ✅ Automatic SSL/HTTPS
- ✅ Built-in monitoring
- ✅ Easy rollbacks
- ✅ $14-30/month (vs $50-200+ traditional hosting)

---

## Super Quick Start

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway init --name rgp-back-office

# 4. Add databases (via Railway dashboard)
# - PostgreSQL
# - Redis

# 5. Initialize database
export DATABASE_URL="[from-railway]"
bash railway-setup.sh

# 6. Deploy (Railway auto-deploys from GitHub)
# Just push your code!
git push origin main
```

**That's it!** Railway handles the rest.

---

## What You Get

### Infrastructure
- **PostgreSQL 17** database (managed)
- **Redis 7** cache (managed)
- **NestJS API** (containerized, auto-scaling)
- **Angular Frontend** (containerized, CDN-ready)

### Features
- Automatic HTTPS
- Custom domains (optional)
- Zero-downtime deploys
- Instant rollbacks
- Real-time logs
- Performance metrics
- Daily backups

### URLs
After deployment:
- **Frontend**: `https://[your-app].up.railway.app`
- **API**: `https://[your-api].up.railway.app`
- **Swagger**: `https://[your-api].up.railway.app/api`

---

## Cost Estimate

| Service | Monthly Cost |
|---------|--------------|
| PostgreSQL | $5-8 |
| Redis | $2-5 |
| Backend API | $5-10 |
| Frontend | $2-5 |
| **Total** | **$14-28** |

**Free Tier Available**: $5 credit/month (good for testing)

**Recommended**: Developer Plan ($20/month for unlimited usage)

---

## Deployment Time

| Step | Time | Difficulty |
|------|------|------------|
| Setup Railway account | 2 min | ⭐ Easy |
| Add databases | 3 min | ⭐ Easy |
| Initialize database | 5 min | ⭐⭐ Medium |
| Deploy backend | 5 min | ⭐ Easy |
| Deploy frontend | 5 min | ⭐ Easy |
| Configure & test | 10 min | ⭐⭐ Medium |
| **Total** | **~30 min** | **⭐⭐ Medium** |

---

## Prerequisites

- [ ] Railway account ([sign up free](https://railway.app))
- [ ] GitHub account
- [ ] Code pushed to GitHub
- [ ] `psql` installed (for database setup)
- [ ] 30 minutes of time

---

## Files Overview

### Configuration
- `api-v2/railway.toml` - Backend Railway config
- `frontend/railway.toml` - Frontend Railway config
- `.railwayignore` - Files to exclude from deployment

### Setup Scripts
- `railway-setup.sh` - Database initialization (Linux/Mac)
- `railway-setup.bat` - Database initialization (Windows)

### Code Changes
- `api-v2/src/main.ts` - Enhanced CORS configuration
- `api-v2/src/health/` - Health check endpoint
- `frontend/src/environments/environment.prod.ts` - Dynamic API URL

### Documentation
- `docs/RAILWAY_QUICK_START.md` - 30-minute deployment guide
- `docs/RAILWAY_DEPLOYMENT_GUIDE.md` - Comprehensive guide
- `docs/RAILWAY_DEPLOYMENT_SUMMARY.md` - Technical summary
- `DEPLOYMENT_CHECKLIST.md` - Complete deployment checklist
- `RAILWAY_README.md` - This file

### CI/CD
- `.github/workflows/railway-deploy.yml` - Automated deployment

---

## Step-by-Step

### 1. Create Railway Project (2 min)

**Via Dashboard:**
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Name it: `rgp-back-office`

**Via CLI:**
```bash
railway login
railway init --name rgp-back-office
```

### 2. Add Services (3 min)

In Railway dashboard:
1. Click **New** → **Database** → **PostgreSQL**
2. Click **New** → **Database** → **Redis**
3. Note the `DATABASE_URL` from PostgreSQL service

### 3. Initialize Database (5 min)

```bash
# Set DATABASE_URL from Railway
export DATABASE_URL="postgresql://postgres:[pass]@[host].railway.app:[port]/railway"

# Run setup script
bash railway-setup.sh

# Verify
psql "$DATABASE_URL" -c "SELECT email FROM app_user WHERE email='admin@rgp.com';"
```

### 4. Deploy Backend (5 min)

1. **New** → **GitHub Repo** → Select `rgp-bo`
2. **Settings** → Root Directory: `api-v2`
3. **Variables** → Add:
   ```bash
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_HOST=${{Redis.REDIS_HOST}}
   REDIS_PORT=${{Redis.REDIS_PORT}}
   JWT_KEY=[generate-random-string]
   FILEUPLOAD_LOCATION=/app/uploads
   ```
4. **Volumes** → New Volume → Mount: `/app/uploads`
5. **Deploy**

Generate JWT_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Deploy Frontend (5 min)

1. **New** → **GitHub Repo** → Select `rgp-bo`
2. **Settings** → Root Directory: `frontend`
3. **Variables** → Add:
   ```bash
   API_URL=https://[backend-url].up.railway.app
   ```
4. **Deploy**

### 6. Configure CORS (2 min)

Backend service → **Variables** → Add:
```bash
CORS_ORIGINS=https://[frontend-url].up.railway.app
```

Redeploy backend.

### 7. Test (5 min)

```bash
# Health check
curl https://[backend].up.railway.app/health

# Login test
curl -X POST https://[backend].up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rgp.com","password":"admin123"}'

# Open frontend
open https://[frontend].up.railway.app
```

Login: `admin@rgp.com` / `admin123`

---

## Verification Checklist

After deployment:

- [ ] Backend health check responds: `/health`
- [ ] Swagger docs accessible: `/api`
- [ ] Frontend loads without errors
- [ ] Can login with admin credentials
- [ ] Dashboard displays correctly
- [ ] Sales module works
- [ ] Products module works
- [ ] File upload works
- [ ] No CORS errors in console

---

## Security Tasks (CRITICAL)

**Do immediately after deployment:**

1. **Change admin password**
   ```bash
   cd util
   node password-util.js hash YourNewSecurePassword
   # Update in database
   ```

2. **Verify JWT_KEY** is not "dev"

3. **Review environment variables** for any secrets

4. **Set LOG_SQL=false** in production

---

## Monitoring

### Railway Dashboard
- Click service → **Metrics** (CPU, Memory, Network)
- Click service → **Logs** (real-time logs)
- Click service → **Deployments** (history, rollback)

### Health Endpoint
```bash
curl https://[backend].up.railway.app/health
```

### Logs
```bash
railway logs --service rgp-api
railway logs --service rgp-frontend
```

---

## Troubleshooting

### Build Fails
```bash
railway logs --service rgp-api
# Check for dependency or Docker issues
```

### Database Connection Fails
```bash
psql "$DATABASE_URL" -c "SELECT version();"
# Verify DATABASE_URL is correct
```

### CORS Errors
```bash
railway variables --service rgp-api | grep CORS
# Verify frontend URL is in CORS_ORIGINS
```

### File Upload Fails
```bash
railway volumes --service rgp-api
# Verify volume mounted at /app/uploads
```

---

## Rollback

If something goes wrong:

1. **Railway Dashboard** → Service → **Deployments**
2. Find last working deployment
3. Click **"Redeploy"**
4. Done! Instant rollback.

---

## Support

### Documentation
- **Quick Start**: Start here → [`docs/RAILWAY_QUICK_START.md`](docs/RAILWAY_QUICK_START.md)
- **Full Guide**: Complete guide → [`docs/RAILWAY_DEPLOYMENT_GUIDE.md`](docs/RAILWAY_DEPLOYMENT_GUIDE.md)
- **Checklist**: Track progress → [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)

### Railway Support
- **Docs**: [docs.railway.app](https://docs.railway.app)
- **Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Status**: [status.railway.app](https://status.railway.app)

### Project Support
- **GitHub Issues**: Report bugs/issues
- **CLAUDE.md**: Complete project context
- **README.md**: Main project documentation

---

## What's Next?

### After Successful Deployment

1. **Security Hardening**
   - Change admin password
   - Update JWT secret
   - Review permissions

2. **Monitoring Setup**
   - Enable uptime monitoring
   - Set up error tracking
   - Configure alerts

3. **Performance Optimization**
   - Monitor metrics
   - Optimize database queries
   - Scale as needed

4. **Team Onboarding**
   - Document production URLs
   - Train team on Railway
   - Establish deployment process

---

## Railway CLI Reference

```bash
# Setup
railway login
railway link

# Deployment
railway up
railway up --service rgp-api

# Management
railway status                       # Service status
railway logs --service rgp-api       # View logs
railway variables                    # List variables
railway open                         # Open in browser

# Database
railway connect postgres             # Connect to DB
railway connect redis                # Connect to Redis
```

---

## Comparison: Railway vs Traditional

| Feature | Railway | Traditional Hosting |
|---------|---------|-------------------|
| Setup Time | 30 min | 4-8 hours |
| Server Management | None | Full responsibility |
| Scaling | Automatic | Manual configuration |
| SSL/HTTPS | Automatic | Manual setup |
| Database Backups | Automatic | Manual setup |
| Monitoring | Built-in | Manual setup |
| Deployments | Git push | Manual FTP/SSH |
| Rollbacks | One-click | Complex |
| Cost | $14-28/mo | $50-200+/mo |

---

## Success Metrics

After deployment, monitor:

- ✅ **Uptime**: Should be >99.9%
- ✅ **Response Time**: <500ms for most endpoints
- ✅ **Error Rate**: <1%
- ✅ **Build Time**: 3-5 minutes
- ✅ **Deploy Time**: <2 minutes
- ✅ **Database Size**: Monitor growth
- ✅ **Cost**: Track monthly spend

---

## Ready to Deploy?

### Choose Your Path:

**Fast Track** (30 min):
→ Follow [`docs/RAILWAY_QUICK_START.md`](docs/RAILWAY_QUICK_START.md)

**Detailed** (1-2 hours):
→ Follow [`docs/RAILWAY_DEPLOYMENT_GUIDE.md`](docs/RAILWAY_DEPLOYMENT_GUIDE.md)

**Checklist-Driven**:
→ Use [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)

---

## Questions?

- Check the guides in `docs/` folder
- Review troubleshooting sections
- Check Railway documentation
- Ask on Railway Discord
- Create GitHub issue

---

**Deployment Status**: ✅ Ready
**Estimated Time**: ~30 minutes
**Difficulty**: ⭐⭐ Medium
**Cost**: $14-28/month

**Let's deploy! 🚀**
