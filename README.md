# RGP Back Office

Point of Sale (POS) Back Office system built with NestJS and Angular.

## Quick Start

### Development

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Update `.env` with your configuration

3. Start development environment:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

4. Access the application:
   - Frontend: http://localhost:8000
   - API: http://localhost:3000

### Production

1. Create production environment file:
```bash
cp .env.example .env
```

2. Update `.env` with secure production values:
   - Set strong `POSTGRES_PASSWORD`
   - Set secure `JWT_KEY`
   - Update `DATABASE_URL` with production credentials

3. Start production environment:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Project Structure

```
rgp-bo/
├── api-v2/          # NestJS API backend
├── frontend/        # Angular frontend
├── docs/            # Documentation
├── scripts/         # Utility scripts (backup, restore, setup)
├── sql/             # SQL scripts and queries
├── tests/           # Test files
├── .env.example     # Environment variables template
├── docker-compose.dev.yml   # Development Docker Compose
└── docker-compose.prod.yml  # Production Docker Compose
```

## Docker Compose Files

- **docker-compose.yml** - Basic configuration (for reference)
- **docker-compose.dev.yml** - Development with hot reload and debugging
- **docker-compose.prod.yml** - Production with health checks and security

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - Complete deployment instructions
- [Analysis Documents](docs/analysis/) - System analysis and improvements
- [Planning Documents](docs/planning/) - Project planning and roadmap

## Scripts

Located in `scripts/` directory:
- `backup.bat` - Database backup utility
- `restore.bat` - Database restore utility
- `setup-test-db.bat` - Test database setup

## Database Management

### Backup Database
```bash
./scripts/backup.bat
```

### Restore Database
```bash
./scripts/restore.bat
```

### Access Database Console
```bash
docker exec -it rgp-db psql -U rgpapp -d rgpdb
```

## Environment Variables

See `.env.example` for all available configuration options.

### Required Variables
- `POSTGRES_PASSWORD` - Database password
- `JWT_KEY` - JWT signing secret
- `DATABASE_URL` - Database connection string

### Optional Variables
- `API_PORT` - API port (default: 3000)
- `FRONTEND_PORT` - Frontend port (default: 8000)
- `DB_PORT` - Database port (default: 5432)

## Development

### View Logs
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Restart Services
```bash
docker-compose -f docker-compose.dev.yml restart
```

### Stop Services
```bash
docker-compose -f docker-compose.dev.yml down
```

## Production

### Update Deployment
```bash
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build
```

### Check Health
```bash
docker-compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## Security Notes

- Never commit `.env` files to version control
- Use strong passwords for production
- Rotate JWT keys regularly
- Keep dependencies updated
- Regular database backups

## Support

For detailed instructions, see [Deployment Guide](docs/DEPLOYMENT.md)
