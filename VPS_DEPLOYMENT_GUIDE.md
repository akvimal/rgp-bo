# RGP Back Office - VPS Deployment Guide

**Last Updated:** 2026-01-26
**Version:** 2.1.3 (Multi-Image OCR + Complete Feature Set)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Initial Server Setup](#initial-server-setup)
4. [Install Docker & Docker Compose](#install-docker--docker-compose)
5. [Application Deployment](#application-deployment)
6. [Database Initialization](#database-initialization)
7. [SSL/HTTPS Setup](#sslhttps-setup)
8. [Domain Configuration](#domain-configuration)
9. [Security Hardening](#security-hardening)
10. [Backup Strategy](#backup-strategy)
11. [Monitoring & Maintenance](#monitoring--maintenance)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- VPS instance (Ubuntu 22.04 LTS or later recommended)
- Root or sudo access
- Minimum 2GB RAM, 2 CPU cores, 20GB storage
- Domain name (optional but recommended)
- Anthropic API key for OCR functionality

### Recommended
- 4GB RAM, 4 CPU cores, 40GB storage
- SSL certificate (Let's Encrypt)
- Firewall configured

---

## Server Requirements

### Minimum Configuration
```
OS: Ubuntu 22.04 LTS
RAM: 2GB
CPU: 2 cores
Storage: 20GB SSD
Network: 100 Mbps
```

### Recommended Configuration
```
OS: Ubuntu 22.04 LTS
RAM: 4GB
CPU: 4 cores
Storage: 40GB SSD
Network: 1 Gbps
Backup: Daily automated backups
```

### Port Requirements
```
80    - HTTP (will redirect to HTTPS)
443   - HTTPS (frontend & API)
22    - SSH (change default port recommended)
5432  - PostgreSQL (internal only, blocked externally)
6379  - Redis (internal only, blocked externally)
```

---

## Initial Server Setup

### 1. Update System

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git vim ufw fail2ban
```

### 2. Create Non-Root User

```bash
# Create deployment user
sudo adduser deployer

# Add to sudo group
sudo usermod -aG sudo deployer

# Switch to deployer user
su - deployer
```

### 3. Configure SSH Security

```bash
# Edit SSH config
sudo vim /etc/ssh/sshd_config

# Change these settings:
Port 2222                    # Change default SSH port
PermitRootLogin no          # Disable root login
PasswordAuthentication no   # Use SSH keys only
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

### 4. Setup SSH Keys

```bash
# On your local machine, generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key to server
ssh-copy-id -p 2222 deployer@your-vps-ip

# Test connection
ssh -p 2222 deployer@your-vps-ip
```

### 5. Configure Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (custom port)
sudo ufw allow 2222/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status verbose
```

---

## Install Docker & Docker Compose

### 1. Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### 2. Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

---

## Application Deployment

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/rgp-bo
sudo chown deployer:deployer /opt/rgp-bo

# Clone repository (adjust URL to your repo)
cd /opt/rgp-bo
git clone https://github.com/your-org/rgp-bo.git .

# Or upload files via SCP/SFTP
```

### 2. Create Environment File

```bash
# Create .env file
vim .env
```

Add the following content:

```bash
# Anthropic API Configuration
# Get your API key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=your-actual-api-key-here
```

**Important:** Replace `your-actual-api-key-here` with your actual Anthropic API key.

### 3. Configure Production Settings

Edit `docker-compose.yml` for production:

```bash
vim docker-compose.yml
```

**Recommended Production Changes:**

```yaml
services:
  api:
    restart: always  # Add this
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://rgpapp:CHANGE_THIS_PASSWORD@postgres:5432/rgpdb
      JWT_KEY: CHANGE_THIS_TO_SECURE_RANDOM_STRING  # Generate strong key
      JWT_EXPIRES: 8h  # Shorter session for production
      LOG_SQL: false
      FILEUPLOAD_LOCATION: /app/upload
      FILEUPLOAD_SIZE_LIMIT: 10485760
      REDIS_HOST: redis
      REDIS_PORT: 6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "127.0.0.1:3002:3000"  # Bind to localhost only

  postgres:
    restart: always  # Add this
    environment:
      POSTGRES_USER: rgpapp
      POSTGRES_PASSWORD: CHANGE_THIS_PASSWORD  # Change this!
      POSTGRES_DB: rgpdb
    ports:
      - "127.0.0.1:5434:5432"  # Bind to localhost only

  redis:
    restart: always  # Add this
    ports:
      - "127.0.0.1:6381:6379"  # Bind to localhost only

  frontend:
    restart: always  # Add this
    ports:
      - "127.0.0.1:8000:80"  # Bind to localhost only
```

**Security Notes:**
- Change all default passwords
- Generate a strong JWT_KEY: `openssl rand -base64 32`
- Bind services to localhost only (use reverse proxy for external access)

### 4. Create Docker Volume for Database

```bash
# Create external volume for PostgreSQL data
docker volume create rgpdata
```

### 5. Build and Start Services

```bash
# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

---

## Database Initialization

### 1. Initialize Database Schema

```bash
# Connect to PostgreSQL container
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# Or run SQL files
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/tables.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/sequences.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/functions.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/views.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/init.sql
```

### 2. Verify Database Setup

```bash
# Check tables
docker exec rgp-db psql -U rgpapp -d rgpdb -c "\dt"

# Check admin user
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT id, email, role_id FROM app_user WHERE email = 'admin@rgp.com';"
```

### 3. Change Default Admin Password

**Important:** Change the default admin password immediately!

```bash
# Login to application at: http://your-vps-ip:8000
# Email: admin@rgp.com
# Password: admin123

# Go to Settings > Users > Change Password
# Or use the backend API directly
```

---

## SSL/HTTPS Setup

### Option 1: Nginx Reverse Proxy with Let's Encrypt (Recommended)

#### 1. Install Nginx

```bash
sudo apt install -y nginx
```

#### 2. Configure Nginx

```bash
sudo vim /etc/nginx/sites-available/rgp-bo
```

Add the following configuration:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size limit (for file uploads)
    client_max_body_size 20M;

    # Frontend (Angular)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-running OCR requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static files (uploads)
    location /uploads {
        alias /home/deployer/uploads;
        autoindex off;
    }
}
```

#### 3. Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/rgp-bo /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 4. Install Certbot and Obtain SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is set up automatically
# Test renewal
sudo certbot renew --dry-run
```

### Option 2: Cloudflare (Simple Alternative)

1. Point your domain to Cloudflare
2. Enable "Full (Strict)" SSL mode in Cloudflare
3. Enable "Always Use HTTPS"
4. Configure origin certificates in Cloudflare dashboard
5. Update Nginx to accept Cloudflare IPs only

---

## Domain Configuration

### 1. DNS Configuration

Point your domain to your VPS IP address:

```
Type    Name                Value           TTL
A       @                   YOUR_VPS_IP     3600
A       www                 YOUR_VPS_IP     3600
```

### 2. Wait for DNS Propagation

```bash
# Check DNS propagation
nslookup your-domain.com
dig your-domain.com
```

### 3. Update Frontend API URL

Edit frontend environment file:

```bash
vim frontend/src/environments/environment.prod.ts
```

Change:

```typescript
export const environment = {
  production: true,
  apiHost: 'https://your-domain.com/api'  // Update to your domain
};
```

Rebuild frontend:

```bash
docker-compose build frontend --no-cache
docker-compose up -d frontend
```

---

## Security Hardening

### 1. Fail2Ban Configuration

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit configuration
sudo vim /etc/fail2ban/jail.local

# Enable SSH jail
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

# Restart Fail2Ban
sudo systemctl restart fail2ban

# Check status
sudo fail2ban-client status
```

### 2. Automatic Security Updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Enable automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Database Security

```bash
# Ensure PostgreSQL is not exposed externally
sudo ufw deny 5432/tcp

# Change default database password (already done in docker-compose.yml)
# Restrict database access to localhost only

# Regular backups (see Backup Strategy section)
```

### 4. Application Security Checklist

- [x] Change default admin password
- [x] Use strong JWT secret key
- [x] Enable HTTPS everywhere
- [x] Configure CORS properly
- [x] Implement rate limiting
- [x] Regular security updates
- [x] Monitor logs for suspicious activity
- [x] Disable unnecessary ports
- [x] Use environment variables for secrets
- [x] Enable audit logging

---

## Backup Strategy

### 1. Database Backup Script

Create backup script:

```bash
vim /opt/rgp-bo/backup-db.sh
```

Add content:

```bash
#!/bin/bash
# Database Backup Script

BACKUP_DIR="/opt/backups/database"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="rgpdb_backup_${DATE}.sql"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Backup database
docker exec rgp-db pg_dump -U rgpapp rgpdb > ${BACKUP_DIR}/${BACKUP_FILE}

# Compress backup
gzip ${BACKUP_DIR}/${BACKUP_FILE}

# Delete backups older than 30 days
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

Make executable:

```bash
chmod +x /opt/rgp-bo/backup-db.sh
```

### 2. Automated Backups with Cron

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/rgp-bo/backup-db.sh >> /var/log/rgp-backup.log 2>&1

# Add weekly full backup (including uploads)
0 3 * * 0 tar -czf /opt/backups/full_backup_$(date +\%Y\%m\%d).tar.gz /opt/rgp-bo/uploads >> /var/log/rgp-backup.log 2>&1
```

### 3. Offsite Backup (Optional)

Upload backups to cloud storage:

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure cloud storage (S3, Google Drive, etc.)
rclone config

# Add to backup script
rclone copy /opt/backups/database remote:rgp-backups/database
```

### 4. Restore from Backup

```bash
# Stop application
cd /opt/rgp-bo
docker-compose down

# Restore database
gunzip -c /opt/backups/database/rgpdb_backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i rgp-db psql -U rgpapp -d rgpdb

# Start application
docker-compose up -d
```

---

## Monitoring & Maintenance

### 1. Docker Health Checks

```bash
# Check container health
docker ps

# Check logs
docker-compose logs -f --tail=100

# Check resource usage
docker stats
```

### 2. Disk Space Monitoring

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up unused Docker resources
docker system prune -a --volumes
```

### 3. Application Monitoring

Install monitoring tools:

```bash
# Install htop for system monitoring
sudo apt install -y htop

# Install netdata for real-time monitoring (optional)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### 4. Log Rotation

```bash
# Configure Docker log rotation
sudo vim /etc/docker/daemon.json
```

Add:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker:

```bash
sudo systemctl restart docker
```

### 5. Database Maintenance

```bash
# Vacuum database (weekly)
docker exec rgp-db psql -U rgpapp -d rgpdb -c "VACUUM ANALYZE;"

# Check database size
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT pg_size_pretty(pg_database_size('rgpdb'));"

# Check table sizes
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

---

## Troubleshooting

### 1. Application Won't Start

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs api
docker-compose logs frontend
docker-compose logs postgres

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 2. Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker logs rgp-db

# Test database connection
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT version();"

# Check environment variables
docker exec rgp-bo-api-1 env | grep DATABASE_URL
```

### 3. Permission Issues

```bash
# Fix upload directory permissions
sudo chown -R deployer:deployer ~/uploads
sudo chmod -R 755 ~/uploads

# Fix Docker socket permissions
sudo usermod -aG docker $USER
# Log out and back in
```

### 4. Memory Issues

```bash
# Check memory usage
free -h

# Check Docker memory
docker stats

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5. SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### 6. OCR Not Working

```bash
# Check Anthropic API key
docker exec rgp-bo-api-1 env | grep ANTHROPIC

# Check API logs
docker logs rgp-bo-api-1 | grep OCR

# Test OCR endpoint
curl -X POST http://localhost:3002/products/ocr/extract \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test-image.jpg"
```

---

## Updating the Application

### 1. Pull Latest Changes

```bash
cd /opt/rgp-bo

# Backup current version
docker-compose down
cp -r /opt/rgp-bo /opt/rgp-bo-backup-$(date +%Y%m%d)

# Pull updates
git pull origin main
```

### 2. Update Database Schema

```bash
# Run migrations if any
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/migrations/XXX_migration.sql
```

### 3. Rebuild and Deploy

```bash
# Rebuild containers
docker-compose build --no-cache

# Restart services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 4. Rollback if Needed

```bash
# Stop current version
docker-compose down

# Restore backup
rm -rf /opt/rgp-bo
mv /opt/rgp-bo-backup-YYYYMMDD /opt/rgp-bo

# Start backup version
cd /opt/rgp-bo
docker-compose up -d
```

---

## Performance Optimization

### 1. Enable Redis Caching

Already configured in docker-compose.yml. Verify:

```bash
# Check Redis is running
docker ps | grep redis

# Test Redis connection
docker exec rgp-redis redis-cli ping
# Should return: PONG
```

### 2. Database Query Optimization

```bash
# Enable query logging temporarily
docker exec rgp-db psql -U rgpapp -d rgpdb -c "ALTER SYSTEM SET log_statement = 'all';"
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT pg_reload_conf();"

# View slow queries
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### 3. Nginx Caching (Optional)

Add to Nginx configuration:

```nginx
# Cache static files
location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

---

## Production Checklist

Before going live, verify:

- [x] Changed all default passwords
- [x] Generated strong JWT secret
- [x] Configured SSL/HTTPS
- [x] Firewall configured correctly
- [x] Database backups automated
- [x] Monitoring setup
- [x] Log rotation configured
- [x] Fail2Ban active
- [x] Automatic security updates enabled
- [x] Domain DNS configured
- [x] Email notifications (optional)
- [x] Application tested thoroughly
- [x] Documentation updated
- [x] Disaster recovery plan documented

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check application logs for errors
- Monitor disk space

**Weekly:**
- Review security logs
- Check backup integrity
- Database vacuum
- Update application if needed

**Monthly:**
- Security audit
- Performance review
- Backup testing
- Update dependencies

### Getting Help

- Check logs: `docker-compose logs -f`
- Review documentation in `docs/` folder
- Check GitHub issues
- Contact: support@your-company.com

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Ubuntu Server Guide](https://ubuntu.com/server/docs)

---

**Deployment Status:** Ready for Production
**Last Reviewed:** 2026-01-26
**Next Review:** 2026-02-26
