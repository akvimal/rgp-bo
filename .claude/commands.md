# Common Commands and Workflows

## Quick Start

### Start Development Environment
```bash
# Start all services with Docker Compose (development mode)
docker-compose -f docker-compose.dev.yml up -d

# Check logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Start Production Environment
```bash
# Start all services (production mode)
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Local Development (Without Docker)

**Backend**:
```bash
cd api-v2
npm install
npm run start:dev    # Hot reload on http://localhost:3000
```

**Frontend**:
```bash
cd frontend
npm install
npm start            # Dev server on http://localhost:4200
```

**Database** (ensure PostgreSQL is running locally):
```bash
# Initialize database
psql -U postgres -f sql/init.sql

# Run DDL scripts
psql -U postgres -d rgp_db -f sql/ddl/001_sequences.sql
psql -U postgres -d rgp_db -f sql/ddl/002_tables.sql
psql -U postgres -d rgp_db -f sql/ddl/003_views.sql
psql -U postgres -d rgp_db -f sql/ddl/004_functions.sql
psql -U postgres -d rgp_db -f sql/ddl/005_seed.sql
```

## Backend Development

### Create New Module
```bash
cd api-v2

# Generate module, controller, and service
nest g module modules/app/feature-name
nest g controller modules/app/feature-name
nest g service modules/app/feature-name
```

### Code Quality
```bash
cd api-v2

# Lint and fix
npm run lint

# Format code
npm run format

# Check TypeScript
npm run build
```

### Testing
```bash
cd api-v2

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

### Build and Run
```bash
cd api-v2

# Build
npm run build

# Run production build
npm run start:prod

# Run with debug
npm run start:debug
```

## Frontend Development

### Create New Feature
```bash
cd frontend

# Generate feature module with routing
ng generate module secured/feature-name --routing

# Generate component
ng generate component secured/feature-name

# Generate service
ng generate service secured/feature-name/services/feature-name

# Generate NgRx store
ng generate @ngrx/schematics:feature secured/store/feature-name --module secured/secured.module.ts
```

### Build
```bash
cd frontend

# Development build
ng build

# Production build
ng build --configuration production

# Watch mode (auto rebuild)
ng build --watch --configuration development
```

### Testing
```bash
cd frontend

# Run tests
ng test

# Run tests with coverage
ng test --code-coverage

# Run tests once (CI mode)
ng test --watch=false
```

## Database Operations

### Backup Database
```bash
# Windows
scripts\backup.bat

# Manual backup (Windows)
docker exec rgp-postgres pg_dump -U postgres rgp_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Linux/Mac
docker exec rgp-postgres pg_dump -U postgres rgp_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
# Windows
scripts\restore.bat backup_file.sql

# Manual restore (Windows)
docker exec -i rgp-postgres psql -U postgres -d rgp_db < backup_file.sql

# Linux/Mac
docker exec -i rgp-postgres psql -U postgres -d rgp_db < backup_file.sql
```

### Database Access
```bash
# Connect to PostgreSQL in Docker
docker exec -it rgp-postgres psql -U postgres -d rgp_db

# Run SQL file
docker exec -i rgp-postgres psql -U postgres -d rgp_db -f /path/to/file.sql

# Check database size
docker exec rgp-postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('rgp_db'));"
```

### Common SQL Queries
```sql
-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check table size
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name)))
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;

-- Check indexes
SELECT * FROM pg_indexes WHERE schemaname = 'public';

-- Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'rgp_db';
```

## Docker Operations

### Build Images
```bash
# Build backend
docker build -t rgp-api:latest ./api-v2

# Build frontend
docker build -t rgp-frontend:latest ./frontend
```

### Container Management
```bash
# List running containers
docker ps

# View logs
docker logs rgp-api
docker logs rgp-frontend
docker logs rgp-postgres

# Follow logs
docker logs -f rgp-api

# Restart container
docker restart rgp-api

# Stop container
docker stop rgp-api

# Remove container
docker rm rgp-api
```

### Clean Up
```bash
# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Complete cleanup
docker system prune -a
```

## Git Workflows

### Feature Development
```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push -u origin feature/feature-name

# Create PR (using GitHub CLI)
gh pr create --title "Add new feature" --body "Description"
```

### Bug Fix
```bash
# Create bugfix branch
git checkout -b fix/bug-description

# Fix and commit
git add .
git commit -m "fix: resolve issue with..."

# Push
git push -u origin fix/bug-description
```

### Update from Main
```bash
# Update local main
git checkout main
git pull origin main

# Update feature branch
git checkout feature/feature-name
git rebase main

# Or merge
git merge main
```

## Environment Setup

### First Time Setup
```bash
# Clone repository
git clone <repository-url>
cd rgp-bo

# Copy environment template
cp .env.example .env

# Edit .env file with your settings
# (DB credentials, JWT secret, etc.)

# Start services
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
docker-compose -f docker-compose.dev.yml logs -f

# Access applications:
# - Frontend: http://localhost:8000
# - API: http://localhost:3000
# - Swagger: http://localhost:3000/api
```

### Environment Variables
```bash
# Required variables in .env:
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=rgp_db

JWT_SECRET=your_secret_key
JWT_EXPIRATION=1d

API_HOST=http://localhost
API_PORT=3000

NODE_ENV=development
```

## Troubleshooting

### Port Conflicts
```bash
# Find process using port (Windows)
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# Find process using port (Linux/Mac)
lsof -i :3000
kill -9 <PID>
```

### Clear Node Modules
```bash
# Backend
cd api-v2
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Reset Database
```bash
# Stop containers
docker-compose down -v

# Remove volumes
docker volume rm rgp-bo_postgres_data

# Restart
docker-compose -f docker-compose.dev.yml up -d
```

### Fix Admin Password
```bash
# Run password fix script
node scripts/fix-admin-password.js

# Default admin credentials:
# Username: admin
# Password: admin123
```

### View API Logs
```bash
# Development (SQL queries visible)
docker logs -f rgp-api

# Production
docker logs -f rgp-api --tail 100
```

### Frontend Build Issues
```bash
cd frontend

# Clear Angular cache
rm -rf .angular

# Clear dist
rm -rf dist

# Rebuild
ng build --configuration production
```

## Testing Workflows

### Test Authentication
```bash
# Run auth test script
node tests/test-auth.js
```

### Test Database Connection
```bash
# Check if PostgreSQL is accessible
docker exec rgp-postgres psql -U postgres -c "SELECT version();"
```

### Test API Endpoints (cURL)
```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get products (with token)
curl -X GET http://localhost:3000/products \
  -H "Authorization: Bearer <your_token>"
```

### Load Testing
```bash
# Using Apache Bench (if installed)
ab -n 1000 -c 10 http://localhost:3000/products

# Using autocannon (npm package)
npx autocannon http://localhost:3000/products
```

## Deployment

### Production Build
```bash
# Build backend
cd api-v2
npm run build

# Build frontend
cd frontend
ng build --configuration production

# Build Docker images
docker-compose -f docker-compose.prod.yml build

# Start production
docker-compose -f docker-compose.prod.yml up -d
```

### Health Checks
```bash
# Check API health
curl http://localhost:3000/health

# Check all containers
docker-compose ps

# Check resource usage
docker stats
```

## Monitoring

### Database Performance
```sql
-- Slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Application Logs
```bash
# API logs
docker logs rgp-api --since 1h

# Frontend Nginx access logs
docker exec rgp-frontend cat /var/log/nginx/access.log

# PostgreSQL logs
docker logs rgp-postgres --since 1h
```

## Utilities

### Generate JWT Secret
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

### Database Migrations
```bash
# Create migration file
cd sql/migrations
touch $(date +%Y-%m-%d)-migration-description.sql

# Apply migration
docker exec -i rgp-postgres psql -U postgres -d rgp_db < sql/migrations/2024-01-01-migration-description.sql
```

### Excel/PDF Utilities
```bash
# Test Excel generation
cd util
node excel-test.js

# Test PDF generation
node pdf-test.js
```

## IDE Setup

### VS Code Recommended Extensions
```json
{
  "recommendations": [
    "angular.ng-template",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "firsttris.vscode-jest-runner",
    "nrwl.angular-console"
  ]
}
```

### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Performance Optimization

### Analyze Bundle Size (Frontend)
```bash
cd frontend

# Install analyzer
npm install --save-dev webpack-bundle-analyzer

# Build with stats
ng build --configuration production --stats-json

# Analyze
npx webpack-bundle-analyzer dist/frontend/stats.json
```

### Database Indexes
```sql
-- Create index for frequently queried columns
CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

### API Performance
```bash
# Enable API profiling
NODE_ENV=development npm run start:dev

# Monitor with clinic.js (if installed)
npx clinic doctor -- node dist/main.js
```

## Quick Reference

### Default Ports
- Frontend: 4200 (dev), 8000/80 (prod)
- Backend API: 3000
- PostgreSQL: 5432
- Debug: 9229

### Default Credentials
- Admin User: admin / admin123
- Database: postgres / postgres (change in production)

### Important URLs
- Frontend: http://localhost:8000
- API: http://localhost:3000
- Swagger: http://localhost:3000/api
- POS: http://localhost:8000/pos

### File Locations
- Environment: `.env`
- Backend Config: `api-v2/src/typeorm-config.service.ts`
- Frontend Config: `frontend/src/environments/`
- Database Schema: `sql/ddl/`
- Migrations: `sql/migrations/`
