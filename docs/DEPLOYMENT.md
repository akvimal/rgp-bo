# Deployment Guide

This guide covers how to deploy the RGP Back Office application in different environments using Docker Compose.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- At least 2GB of available RAM
- Ports 3000, 5432, and 8000 available

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rgp-bo
```

### 2. Create Environment File

Copy the example environment file and update it with your values:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration:

```bash
# For Linux/Mac
nano .env

# For Windows
notepad .env
```

**Important**: Update the following critical values:
- `POSTGRES_PASSWORD`: Use a strong, unique password
- `JWT_KEY`: Use a secure, randomly generated key
- `DATABASE_URL`: Update with your actual database credentials

### 3. Generate Secure Values

For production, generate secure values for sensitive environment variables:

```bash
# Generate a secure JWT key (Linux/Mac)
openssl rand -base64 32

# Generate a secure password (Linux/Mac)
openssl rand -base64 16
```

## Development Deployment

Development mode includes hot reload, debugging ports, and verbose logging.

### Start Development Environment

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f api
```

### Stop Development Environment

```bash
docker-compose -f docker-compose.dev.yml down
```

### Development Features

- Hot reload for API changes
- SQL query logging enabled
- Debug port exposed on 9229
- Source code mounted as volumes
- Default credentials (not secure)

## Production Deployment

Production mode uses optimized builds, health checks, and secure configurations.

### Start Production Environment

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Check Service Health

```bash
# Check running containers
docker-compose -f docker-compose.prod.yml ps

# Check health status
docker inspect --format='{{.State.Health.Status}}' <container-name>
```

### View Logs

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Stop Production Environment

```bash
docker-compose -f docker-compose.prod.yml down
```

### Update Production Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker-compose -f docker-compose.prod.yml up -d --build

# Remove old images
docker image prune -f
```

## Environment Variables

### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | production | Yes |
| `API_PORT` | API service port | 3000 | No |
| `FRONTEND_PORT` | Frontend port | 8000 | No |

### Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_USER` | Database username | rgpapp | Yes |
| `POSTGRES_PASSWORD` | Database password | - | Yes |
| `POSTGRES_DB` | Database name | rgpdb | Yes |
| `DB_HOST` | Database host | postgres | No |
| `DB_PORT` | Database port | 5432 | No |
| `DATABASE_URL` | Full database connection string | - | Yes |

### Security Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_KEY` | JWT signing secret | - | Yes |
| `JWT_EXPIRES` | JWT token expiration | 24h | No |

### File Upload Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `FILEUPLOAD_LOCATION` | Upload directory path | /app/upload | No |
| `FILEUPOAD_SIZE_LIMIT` | Max file size in bytes | 512000 | No |
| `UPLOADS_PATH` | Host upload directory | ~/uploads | No |

### Logging Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_SQL` | Enable SQL query logging | false | No |

## Database Management

### Create Database Backup

```bash
# Using the provided backup script
./scripts/backup.bat

# Or using docker exec
docker exec rgp-db pg_dump -U rgpapp rgpdb > backup.sql
```

### Restore Database

```bash
# Using the provided restore script
./scripts/restore.bat

# Or using docker exec
docker exec -i rgp-db psql -U rgpapp -d rgpdb < backup.sql
```

### Access Database Console

```bash
docker exec -it rgp-db psql -U rgpapp -d rgpdb
```

## Accessing the Application

Once deployed, access the application at:

- **Frontend**: http://localhost:8000 (or your configured `FRONTEND_PORT`)
- **API**: http://localhost:3000 (or your configured `API_PORT`)
- **API Health Check**: http://localhost:3000/health

## Troubleshooting

### Services Won't Start

Check logs for errors:
```bash
docker-compose -f docker-compose.prod.yml logs
```

### Database Connection Issues

1. Verify database is running:
```bash
docker-compose -f docker-compose.prod.yml ps postgres
```

2. Check database logs:
```bash
docker-compose -f docker-compose.prod.yml logs postgres
```

3. Verify DATABASE_URL is correct in .env file

### Port Already in Use

Change the port in your .env file:
```bash
API_PORT=3001
FRONTEND_PORT=8001
DB_PORT=5433
```

### Permission Issues with Uploads

Ensure the uploads directory has correct permissions:
```bash
# Linux/Mac
chmod -R 755 ~/uploads

# Windows
icacls "%USERPROFILE%\uploads" /grant Users:F /T
```

### Reset Everything

To completely reset the environment:
```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Remove volumes (WARNING: This deletes all data)
docker-compose -f docker-compose.prod.yml down -v

# Remove images
docker-compose -f docker-compose.prod.yml down --rmi all

# Start fresh
docker-compose -f docker-compose.prod.yml up -d
```

## Security Best Practices

1. **Never commit .env files** - They are excluded in .gitignore
2. **Use strong passwords** - Generate secure random passwords
3. **Rotate JWT keys regularly** - Update JWT_KEY periodically
4. **Enable SSL/TLS** - Use reverse proxy with SSL certificates
5. **Limit database exposure** - Don't expose DB port in production
6. **Regular backups** - Schedule automated database backups
7. **Update dependencies** - Keep Docker images and npm packages updated
8. **Use secrets management** - Consider Docker Secrets or vault services for production

## Monitoring

### Health Checks

All services include health checks in production mode:
- API: HTTP check on /health endpoint
- Database: PostgreSQL ready check
- Frontend: HTTP check on root

### Resource Usage

Monitor container resource usage:
```bash
docker stats
```

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review documentation in `/docs`
- Check GitHub issues
