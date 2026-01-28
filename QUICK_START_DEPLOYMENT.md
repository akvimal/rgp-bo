# Quick Start Deployment Guide

**For experienced users who want to get started quickly**

For detailed instructions, see [VPS_DEPLOYMENT_GUIDE.md](VPS_DEPLOYMENT_GUIDE.md)

---

## Prerequisites

- Ubuntu 22.04 VPS
- Root/sudo access
- Docker & Docker Compose installed
- Anthropic API key

---

## 5-Minute Quick Start

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Clone & Configure

```bash
# Clone repository
git clone https://github.com/your-org/rgp-bo.git
cd rgp-bo

# Create environment file
cp .env.example .env
nano .env  # Add your ANTHROPIC_API_KEY

# Create database volume
docker volume create rgpdata
```

### 4. Deploy

```bash
# Build and start
docker-compose build --no-cache
docker-compose up -d

# Initialize database
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/tables.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/sequences.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/functions.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/ddl/views.sql
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/init.sql
```

### 5. Access Application

```
URL: http://your-vps-ip:8000
Email: admin@rgp.com
Password: admin123
```

**⚠️ Change the admin password immediately!**

---

## Production Deployment

### Security Hardening

```bash
# Change default passwords in docker-compose.yml
vim docker-compose.yml

# Generate strong JWT key
openssl rand -base64 32

# Update docker-compose.yml:
# - Change POSTGRES_PASSWORD
# - Change JWT_KEY to generated value
# - Bind ports to localhost only
```

### SSL Setup with Nginx

```bash
# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/rgp-bo
```

Add configuration (see VPS_DEPLOYMENT_GUIDE.md for full config), then:

```bash
sudo ln -s /etc/nginx/sites-available/rgp-bo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### Automated Backups

```bash
# Create backup script
cat > /opt/rgp-bo/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/database"
DATE=$(date +"%Y%m%d_%H%M%S")
mkdir -p ${BACKUP_DIR}
docker exec rgp-db pg_dump -U rgpapp rgpdb | gzip > ${BACKUP_DIR}/rgpdb_backup_${DATE}.sql.gz
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /opt/rgp-bo/backup-db.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/rgp-bo/backup-db.sh") | crontab -
```

---

## Common Commands

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Update application
git pull
docker-compose build --no-cache
docker-compose up -d

# Backup database
docker exec rgp-db pg_dump -U rgpapp rgpdb > backup.sql

# Restore database
docker exec -i rgp-db psql -U rgpapp -d rgpdb < backup.sql
```

---

## Troubleshooting

**Service won't start:**
```bash
docker-compose logs api
docker-compose logs frontend
docker-compose logs postgres
```

**Database connection error:**
```bash
docker exec rgp-db psql -U rgpapp -d rgpdb -c "SELECT version();"
```

**Permission issues:**
```bash
sudo chown -R $USER:$USER ~/uploads
chmod 755 ~/uploads
```

---

## Next Steps

1. ✅ Change admin password
2. ✅ Configure SSL/HTTPS
3. ✅ Setup automated backups
4. ✅ Configure firewall
5. ✅ Enable monitoring
6. ✅ Test all features
7. ✅ Read full deployment guide: [VPS_DEPLOYMENT_GUIDE.md](VPS_DEPLOYMENT_GUIDE.md)

---

**Need Help?** See detailed documentation in [VPS_DEPLOYMENT_GUIDE.md](VPS_DEPLOYMENT_GUIDE.md)
