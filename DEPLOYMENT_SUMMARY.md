# RGP Back Office - Deployment Documentation Summary

**Last Updated:** 2026-01-26
**Version:** 2.1.3

---

## Available Deployment Guides

### 1. 📘 [VPS_DEPLOYMENT_GUIDE.md](VPS_DEPLOYMENT_GUIDE.md) - Complete Production Guide
**Comprehensive guide for production VPS deployment**

**Includes:**
- Server requirements and setup
- Docker & Docker Compose installation
- SSL/HTTPS configuration with Let's Encrypt
- Nginx reverse proxy setup
- Security hardening (Fail2Ban, UFW, SSH)
- Automated backup strategy
- Monitoring and maintenance
- Troubleshooting guide
- Performance optimization

**Best for:**
- Production deployments
- First-time deployments
- Setting up from scratch
- Enterprise environments

**Estimated time:** 2-3 hours

---

### 2. ⚡ [QUICK_START_DEPLOYMENT.md](QUICK_START_DEPLOYMENT.md) - Quick Start Guide
**Fast deployment for experienced users**

**Includes:**
- Essential commands only
- 5-minute quick start
- Basic security setup
- Common commands reference

**Best for:**
- Experienced DevOps engineers
- Development/staging environments
- Quick testing
- Users familiar with Docker

**Estimated time:** 15-30 minutes

---

## Configuration Files

### Production Configuration Files

1. **docker-compose.prod.yml** - Production Docker Compose
   - Security-hardened configuration
   - Localhost-only bindings
   - Log rotation configured
   - Restart policies enabled

2. **.env.example** - Environment variables template
   - Copy to `.env` and configure
   - Never commit `.env` to version control

3. **docker-compose.yml** - Development/local configuration
   - Default configuration
   - Suitable for local development

---

## Deployment Workflow

```
┌─────────────────────────────────────────────┐
│  1. Choose Deployment Type                   │
│     □ Production → Use VPS_DEPLOYMENT_GUIDE │
│     □ Quick Test → Use QUICK_START_DEPLOYMENT│
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  2. Server Preparation                       │
│     □ Install Docker & Docker Compose        │
│     □ Configure firewall                     │
│     □ Setup SSH keys                         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  3. Application Setup                        │
│     □ Clone repository                       │
│     □ Configure .env file                    │
│     □ Create Docker volumes                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  4. Deploy                                   │
│     □ Build containers                       │
│     □ Initialize database                    │
│     □ Start services                         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  5. Post-Deployment (Production Only)        │
│     □ Configure SSL/HTTPS                    │
│     □ Setup Nginx reverse proxy              │
│     □ Enable automated backups               │
│     □ Configure monitoring                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  6. Verify & Secure                          │
│     □ Change default admin password          │
│     □ Test all features                      │
│     □ Review security checklist              │
└─────────────────────────────────────────────┘
```

---

## Quick Reference

### Development (Local)

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access:** http://localhost:8000

---

### Production (VPS)

```bash
# Deploy with production config
docker-compose -f docker-compose.prod.yml up -d

# Behind Nginx reverse proxy
# Access via: https://your-domain.com
```

**Access:** https://your-domain.com

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API key for OCR functionality | `sk-ant-api03-...` |

### Optional (Production)

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_KEY` | JWT secret key | `dev` (change in production!) |
| `JWT_EXPIRES` | JWT token expiration | `24h` (use `8h` for production) |
| `DATABASE_URL` | PostgreSQL connection | Auto-configured |
| `REDIS_HOST` | Redis server | `redis` |

---

## Default Credentials

**⚠️ IMPORTANT: Change immediately after first login!**

```
Email: admin@rgp.com
Password: admin123
```

**To change:**
1. Login to application
2. Go to: Settings > Users > Change Password
3. Set a strong password (minimum 12 characters)

---

## Port Reference

### Development (docker-compose.yml)

| Service | Port | Access |
|---------|------|--------|
| Frontend | 8000 | http://localhost:8000 |
| API | 3002 | http://localhost:3002 |
| PostgreSQL | 5434 | localhost only |
| Redis | 6381 | localhost only |

### Production (docker-compose.prod.yml)

| Service | Port | Access |
|---------|------|--------|
| Frontend | 127.0.0.1:8000 | Via Nginx reverse proxy |
| API | 127.0.0.1:3002 | Via Nginx reverse proxy |
| PostgreSQL | 127.0.0.1:5434 | localhost only |
| Redis | 127.0.0.1:6381 | localhost only |

**External access via:**
- HTTP: Port 80 → Nginx → Redirects to HTTPS
- HTTPS: Port 443 → Nginx → Frontend/API

---

## Security Checklist

### Pre-Deployment
- [ ] Review security requirements
- [ ] Generate strong passwords
- [ ] Obtain SSL certificate
- [ ] Configure firewall rules

### During Deployment
- [ ] Change database password
- [ ] Set secure JWT key
- [ ] Configure Redis password
- [ ] Setup .env file properly

### Post-Deployment
- [ ] Change admin password
- [ ] Test SSL/HTTPS
- [ ] Verify firewall rules
- [ ] Enable automated backups
- [ ] Configure monitoring
- [ ] Test disaster recovery

---

## Backup & Recovery

### Automated Backups

**Daily Database Backup:**
```bash
0 2 * * * /opt/rgp-bo/backup-db.sh
```

**Weekly Full Backup:**
```bash
0 3 * * 0 tar -czf /opt/backups/full_backup_$(date +\%Y\%m\%d).tar.gz /opt/rgp-bo
```

### Manual Backup

```bash
# Backup database
docker exec rgp-db pg_dump -U rgpapp rgpdb > backup.sql

# Backup uploads
tar -czf uploads-backup.tar.gz ~/uploads
```

### Recovery

```bash
# Restore database
docker exec -i rgp-db psql -U rgpapp -d rgpdb < backup.sql

# Restore uploads
tar -xzf uploads-backup.tar.gz -C ~/
```

---

## Troubleshooting Quick Links

### Common Issues

1. **Service won't start** → See VPS_DEPLOYMENT_GUIDE.md § Troubleshooting #1
2. **Database connection error** → See VPS_DEPLOYMENT_GUIDE.md § Troubleshooting #2
3. **Permission issues** → See VPS_DEPLOYMENT_GUIDE.md § Troubleshooting #3
4. **Memory issues** → See VPS_DEPLOYMENT_GUIDE.md § Troubleshooting #4
5. **SSL certificate issues** → See VPS_DEPLOYMENT_GUIDE.md § Troubleshooting #5

### Quick Diagnostics

```bash
# Check all services
docker-compose ps

# View all logs
docker-compose logs -f

# Check disk space
df -h

# Check memory
free -h

# Check Docker resources
docker system df
```

---

## Monitoring & Maintenance

### Daily Checks
- Application logs: `docker-compose logs -f --tail=100`
- Disk space: `df -h`
- Service status: `docker-compose ps`

### Weekly Checks
- Review security logs
- Check backup integrity
- Database maintenance: `VACUUM ANALYZE`
- Update application if needed

### Monthly Checks
- Security audit
- Performance review
- Dependency updates
- Backup testing

---

## Support Resources

### Documentation
- [VPS_DEPLOYMENT_GUIDE.md](VPS_DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [QUICK_START_DEPLOYMENT.md](QUICK_START_DEPLOYMENT.md) - Quick start guide
- [claude.md](claude.md) - Project context for development

### Application Features
- [FEATURES_SUMMARY.md](FEATURES_SUMMARY.md) - Feature overview
- [docs/OCR_COMPREHENSIVE_GUIDE.md](docs/OCR_COMPREHENSIVE_GUIDE.md) - Complete OCR documentation
- [SETUP_ANTHROPIC_API.md](SETUP_ANTHROPIC_API.md) - API setup guide

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1.4 | 2026-01-27 | Documentation consolidation, project cleanup |
| 2.1.3 | 2026-01-26 | Complete deployment documentation, OCR fixes |
| 2.1.2 | 2026-01-26 | Duplicate detection, delete fixes |
| 2.1.1 | 2026-01-26 | Auto-category, pack parsing |
| 2.1.0 | 2026-01-26 | Multi-image OCR with combined contextualization |

---

## Next Steps

1. **Choose your deployment path:**
   - Production → Read [VPS_DEPLOYMENT_GUIDE.md](VPS_DEPLOYMENT_GUIDE.md)
   - Quick test → Read [QUICK_START_DEPLOYMENT.md](QUICK_START_DEPLOYMENT.md)

2. **Prepare your environment:**
   - VPS server or local machine
   - Domain name (for production)
   - Anthropic API key

3. **Start deployment:**
   - Follow the chosen guide step-by-step
   - Refer back to this summary as needed

4. **Post-deployment:**
   - Complete security checklist
   - Setup monitoring
   - Test all features
   - Document your specific configuration

---

**Ready to deploy?** Choose your guide above and get started! 🚀
