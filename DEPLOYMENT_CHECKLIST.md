# Railway Deployment Checklist

Use this checklist to ensure a smooth deployment to Railway.

---

## Pre-Deployment

### Code Preparation
- [ ] All code committed and pushed to GitHub
- [ ] Tests passing locally
- [ ] Environment files reviewed (no secrets committed)
- [ ] Database migrations tested
- [ ] Docker builds successfully locally

### Railway Account Setup
- [ ] Railway account created
- [ ] Payment method added (if using paid plan)
- [ ] Railway CLI installed: `npm i -g @railway/cli`
- [ ] Logged in: `railway login`

### Documentation Review
- [ ] Read `docs/RAILWAY_QUICK_START.md`
- [ ] Read `docs/RAILWAY_DEPLOYMENT_GUIDE.md`
- [ ] Database initialization scripts ready

---

## Deployment Steps

### 1. Create Railway Project
- [ ] Project created: `railway init --name rgp-back-office`
- [ ] Project linked to local repository

### 2. Database Services
- [ ] PostgreSQL service added
- [ ] Redis service added
- [ ] Connection strings saved securely
- [ ] Database initialized with `railway-setup.sh` or `railway-setup.bat`
- [ ] Admin user verified: `admin@rgp.com`

### 3. Backend API Deployment
- [ ] GitHub repository connected
- [ ] Root directory set to `api-v2`
- [ ] Service named `rgp-api`
- [ ] All environment variables configured:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3000`
  - [ ] `DATABASE_URL` (linked to Postgres)
  - [ ] `REDIS_HOST` (linked to Redis)
  - [ ] `REDIS_PORT=6379`
  - [ ] `JWT_KEY` (secure random string)
  - [ ] `JWT_EXPIRES=24h`
  - [ ] `FILEUPLOAD_LOCATION=/app/uploads`
  - [ ] `FILEUPLOAD_SIZE_LIMIT=10485760`
  - [ ] `LOG_SQL=false`
  - [ ] `ANTHROPIC_API_KEY` (if using AI features)
- [ ] Railway volume created and mounted at `/app/uploads`
- [ ] Build completed successfully
- [ ] Deployment successful
- [ ] Public URL noted and saved

### 4. Frontend Deployment
- [ ] GitHub repository connected
- [ ] Root directory set to `frontend`
- [ ] Service named `rgp-frontend`
- [ ] Environment variables configured:
  - [ ] `API_URL` (backend public URL)
- [ ] Build completed successfully
- [ ] Deployment successful
- [ ] Public URL noted and saved

### 5. CORS Configuration
- [ ] Backend `CORS_ORIGINS` updated with frontend URL
- [ ] Backend redeployed
- [ ] CORS verified working

---

## Post-Deployment Verification

### Health Checks
- [ ] Backend health endpoint responds: `/health`
- [ ] Swagger documentation accessible: `/api`
- [ ] Frontend loads without errors
- [ ] No console errors in browser

### Authentication
- [ ] Login page loads
- [ ] Can login with `admin@rgp.com` / `admin123`
- [ ] JWT token generated correctly
- [ ] Protected routes accessible after login

### Core Functionality
- [ ] Dashboard loads
- [ ] Sales module works
- [ ] Products module works
- [ ] Customers module works
- [ ] Purchases module works
- [ ] Stock module works
- [ ] Reports generate correctly
- [ ] File upload works (test document upload)

### Database
- [ ] Database queries working
- [ ] Transactions working correctly
- [ ] No connection pool errors
- [ ] No timeout errors

### Cache
- [ ] Redis connection working
- [ ] Cache hit/miss logged correctly
- [ ] Performance improved with caching

---

## Security Hardening

### Critical Security Tasks (DO IMMEDIATELY)
- [ ] Change admin password from `admin123`
- [ ] Verify `JWT_KEY` is secure random string (not "dev")
- [ ] Verify `DATABASE_URL` uses Railway-generated credentials
- [ ] Review all environment variables for sensitive data
- [ ] Disable `LOG_SQL` in production (set to `false`)

### Additional Security
- [ ] HTTPS enforced (Railway provides this)
- [ ] CORS properly configured (only allowed domains)
- [ ] File upload size limits set
- [ ] Rate limiting considered (if needed)
- [ ] Security headers configured

---

## Monitoring & Operations

### Monitoring Setup
- [ ] Railway metrics reviewed (CPU, Memory, Network)
- [ ] Log monitoring configured
- [ ] Error tracking set up (optional: Sentry, LogRocket)
- [ ] Uptime monitoring configured (optional: UptimeRobot)

### Backup Strategy
- [ ] Railway automatic backups verified
- [ ] Manual backup tested:
  ```bash
  pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql
  ```
- [ ] Backup restoration tested
- [ ] File upload backups planned (Railway volumes or cloud storage)

### Documentation
- [ ] Production URLs documented
- [ ] Environment variables documented (securely)
- [ ] Access credentials documented (securely)
- [ ] Runbook created for common operations
- [ ] Team members granted access

---

## Performance Optimization

### Database
- [ ] Database indexes reviewed
- [ ] Query performance monitored
- [ ] Connection pool configured appropriately
- [ ] VACUUM and ANALYZE scheduled (if needed)

### API
- [ ] Response times acceptable (<500ms for most endpoints)
- [ ] Redis caching working
- [ ] No N+1 query issues
- [ ] API rate limiting configured (if needed)

### Frontend
- [ ] Bundle size optimized
- [ ] Static assets cached
- [ ] Lazy loading implemented where appropriate
- [ ] CDN considered for static assets (if needed)

---

## CI/CD (Optional)

### GitHub Actions
- [ ] Railway GitHub Actions workflow configured
- [ ] `RAILWAY_TOKEN` secret added to GitHub
- [ ] `RAILWAY_PROJECT_ID` secret added
- [ ] `RAILWAY_API_URL` secret added
- [ ] Automated tests run before deployment
- [ ] Deployment notifications configured

---

## Rollback Plan

### Preparation
- [ ] Previous working deployment identified
- [ ] Database backup before deployment
- [ ] Rollback procedure documented
- [ ] Team aware of rollback process

### Rollback Steps (If Needed)
1. [ ] Railway Dashboard → Service → Deployments
2. [ ] Find last working deployment
3. [ ] Click "Redeploy"
4. [ ] Verify rollback successful
5. [ ] If database changes: restore from backup

---

## Cost Management

### Initial Setup
- [ ] Railway plan selected (Hobby/Developer/Pro)
- [ ] Estimated monthly cost calculated
- [ ] Budget approved
- [ ] Billing alerts configured

### Ongoing Monitoring
- [ ] Weekly cost review
- [ ] Resource usage monitored
- [ ] Optimization opportunities identified
- [ ] Scale up/down as needed

### Estimated Costs (Developer Plan)
- PostgreSQL: $5-8/month
- Redis: $2-5/month
- API Backend: $5-10/month
- Frontend: $2-5/month
- **Total: $14-28/month**

---

## Support & Documentation

### Documentation Updated
- [ ] README.md updated with production URLs
- [ ] CLAUDE.md updated with deployment info
- [ ] Team documentation updated
- [ ] API documentation updated

### Team Training
- [ ] Team familiar with Railway dashboard
- [ ] Team knows how to view logs
- [ ] Team knows how to redeploy
- [ ] Team knows rollback procedure
- [ ] On-call rotation established (if needed)

### Support Contacts
- [ ] Railway support contact documented
- [ ] Internal support team identified
- [ ] Escalation procedure documented

---

## Go-Live

### Final Checks
- [ ] All above checkboxes completed
- [ ] Stakeholders informed
- [ ] Go-live date/time confirmed
- [ ] Team standing by for monitoring

### Launch
- [ ] DNS updated (if using custom domain)
- [ ] Users notified
- [ ] Launch announced
- [ ] Initial monitoring period (24-48 hours)

### Post-Launch
- [ ] Monitor for 24 hours continuously
- [ ] Address any issues immediately
- [ ] Collect user feedback
- [ ] Document lessons learned
- [ ] Plan for future improvements

---

## Troubleshooting Reference

### Quick Diagnosis
```bash
# Check service status
railway status

# View logs
railway logs --service rgp-api
railway logs --service rgp-frontend

# Test database
psql "$DATABASE_URL" -c "SELECT version();"

# Test API health
curl https://[your-backend].up.railway.app/health
```

### Common Issues
- **Build fails**: Check build logs, verify dependencies
- **Database connection fails**: Verify DATABASE_URL, check Postgres status
- **CORS errors**: Update CORS_ORIGINS, redeploy
- **File upload fails**: Check Railway volume, verify mount path
- **Out of memory**: Monitor metrics, consider upgrading plan

---

## Completion Sign-Off

- [ ] Deployment completed by: _______________ Date: _______________
- [ ] Verified by: _______________ Date: _______________
- [ ] Production ready: ☐ Yes ☐ No ☐ With issues (document below)

### Notes/Issues:
```
[Document any issues or deviations from standard deployment]
```

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Railway Project ID**: _______________
**Production URLs**:
- Frontend: _______________
- Backend API: _______________
- Swagger Docs: _______________

---

*This checklist should be completed for every production deployment.*
