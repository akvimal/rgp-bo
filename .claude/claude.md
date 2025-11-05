# RGP Back Office - Project Documentation

## Project Overview

**Name**: RGP Back Office (POS Management System)
**Type**: Full-stack Enterprise Web Application
**Purpose**: Comprehensive Point of Sale (POS) back office management system for retail/pharmacy operations

## Architecture

### 3-Tier Architecture
1. **Presentation Layer**: Angular 12 SPA with NgRx state management
2. **Business Logic Layer**: NestJS REST API with JWT authentication
3. **Data Layer**: PostgreSQL 17.4 database

### Component Structure
```
rgp-bo/
├── api-v2/          # NestJS Backend API (Port 3000)
├── frontend/        # Angular Frontend SPA (Port 8000/4200)
├── sql/             # Database DDL, migrations, and seed data
├── docs/            # Project documentation and analysis
├── scripts/         # Utility scripts (backup, restore, setup)
├── tests/           # Integration tests
└── util/            # Utility tools (PDF, Excel, SFTP)
```

## Technology Stack

### Backend (api-v2/)
- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.7.3
- **Runtime**: Node.js 22.14.0
- **ORM**: TypeORM 0.3.21
- **Database**: PostgreSQL 17.4
- **Authentication**: Passport.js + JWT
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger
- **Key Features**: Scheduled tasks (@nestjs/schedule), Excel generation (exceljs)

### Frontend (frontend/)
- **Framework**: Angular 12.2.0
- **Language**: TypeScript 4.3.5
- **State Management**: NgRx 12.5.1 (Store, Effects, DevTools)
- **UI Libraries**: PrimeNG 12.2.2, Bootstrap 5.2.3
- **Charts**: @swimlane/ngx-charts
- **Authentication**: @auth0/angular-jwt

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (frontend)
- **Database**: PostgreSQL 17.4-alpine

## Key Business Modules

### Backend Modules (NestJS)
1. **auth/** - JWT authentication and user login
2. **users/** - User management and profiles
3. **roles/** - Role-based access control (RBAC)
4. **products/** - Product catalog, pricing, quantity tracking
5. **vendors/** - Vendor management and payments
6. **customers/** - Customer records and credit accounts
7. **purchases/** - Purchase orders, invoices, requests
8. **sales/** - Sales transactions and deliveries
9. **returns/** - Sale returns management
10. **stock/** - Inventory and stock movements
11. **documents/** - Document generation and exports
12. **files/** - File upload handling
13. **reports/** - Business intelligence and Excel reports
14. **lookup/** - Reference data services
15. **backup/** - Scheduled database backups

### Frontend Features
- Dashboard with analytics and charts
- Product management (inventory, pricing)
- Customer management
- Sales processing (POS interface at /pos)
- Purchase orders
- Reports and business intelligence
- Settings and system configuration
- Multi-store support

## Important Conventions

### Backend (NestJS)

#### Module Structure
Each feature module follows this pattern:
```
module-name/
├── module-name.module.ts       # Module definition
├── module-name.controller.ts   # REST endpoints
├── module-name.service.ts      # Business logic
└── dto/                        # Data Transfer Objects
    ├── create-*.dto.ts
    └── update-*.dto.ts
```

#### Entity Location
- All TypeORM entities are in `api-v2/src/entities/`
- Base entity with common fields: `base.entity.ts`
- 23 entities total representing database tables

#### Authentication Pattern
- JWT tokens with configurable expiration
- `@UseGuards(JwtAuthGuard)` decorator for protected routes
- Password hashing with bcryptjs
- User roles and permissions in database

#### Error Handling
- Global exception filter: `api-v2/src/core/http-exception.filter.ts`
- Custom exceptions in `api-v2/src/core/exceptions/`
- Consistent JSON error responses

### Frontend (Angular)

#### Routing
- Root redirects to login
- `/secure/*` - Lazy-loaded secured module (protected by AuthGuard)
- `/pos` - Point of Sale component
- Auth guard: `frontend/src/app/@core/auth/auth.guard.ts`

#### State Management
- NgRx store for global state
- Effects for side effects and async operations
- Redux DevTools for debugging

#### Authentication Flow
- Token stored in localStorage via CredentialsService
- HTTP interceptor adds JWT to all requests: `auth-token.interceptor.ts`
- Auth directives: `isAuth`, `isNavAuth` for permission-based UI

#### UI Components
- PrimeNG components for rich UI (tables, forms, dialogs)
- Bootstrap for layout and responsive design
- Custom pipes in `shared/pipes/`

## Database

### Schema Organization
```
sql/ddl/
├── 001_sequences.sql    # Sequence definitions
├── 002_tables.sql       # Table structures (23 tables)
├── 003_views.sql        # Database views
├── 004_functions.sql    # Stored procedures
└── 005_seed.sql         # Initial seed data
```

### Performance Tuning
- PostgreSQL optimized for SSD storage
- Connection pooling via TypeORM
- Shared buffers: 256MB
- Effective cache size: 1GB
- WAL tuning for write performance

## Development Workflow

### Environment Setup

**Development**:
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Features:
# - Hot reload for both frontend and backend
# - SQL query logging enabled
# - Debug port 9229 exposed for API
# - Volume mounted source code
```

**Production**:
```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# Features:
# - Optimized builds
# - Health checks for all services
# - Performance tuning
# - Restart policies
```

### Common Commands

**Backend (api-v2/)**:
```bash
npm run start:dev        # Development with hot reload
npm run build            # Production build
npm run start:prod       # Start production build
npm run lint             # ESLint check and fix
npm run format           # Prettier formatting
npm test                 # Run Jest tests
npm run test:cov         # Test coverage
```

**Frontend (frontend/)**:
```bash
npm start                # Development server (port 4200)
ng build --configuration production  # Production build
ng test                  # Run Jasmine/Karma tests
```

**Database**:
```bash
# Backup (Windows)
scripts/backup.bat

# Restore (Windows)
scripts/restore.bat [backup_file]

# Fix admin password
node scripts/fix-admin-password.js
```

## Key Files Reference

### Configuration Files
- `.env.example` - Environment variable template
- `api-v2/nest-cli.json` - NestJS CLI configuration
- `api-v2/tsconfig.json` - Backend TypeScript config (ES2023)
- `frontend/angular.json` - Angular CLI configuration
- `frontend/tsconfig.json` - Frontend TypeScript config (ES2017)
- `frontend/nginx.conf` - Nginx web server configuration

### Important Source Files
- `api-v2/src/main.ts` - API entry point, CORS, Swagger setup
- `api-v2/src/app.module.ts` - Root module
- `api-v2/src/typeorm-config.service.ts` - Database configuration
- `frontend/src/app/app.module.ts` - Frontend root module
- `frontend/src/app/app-routing.module.ts` - Routing configuration
- `frontend/src/environments/environment.ts` - Frontend environment config

### Documentation
- `README.md` - Main project documentation
- `docs/DEPLOYMENT.md` - Deployment guide
- `docs/POSTGRESQL_TUNING.md` - Database optimization
- `docs/planning/` - Project planning documents
- `docs/analysis/` - System analysis documents

## API Documentation

When API is running, Swagger documentation available at:
```
http://localhost:3000/api
```

## Security Considerations

1. **JWT Authentication**: Tokens expire after configured duration
2. **Password Security**: bcryptjs hashing (never store plain text)
3. **Environment Variables**: Keep `.env` files out of git (in .gitignore)
4. **CORS**: Configured in `api-v2/src/main.ts`
5. **Role-Based Access**: Check permissions before operations
6. **SQL Injection**: Prevented by TypeORM parameterized queries
7. **Nginx**: Acts as reverse proxy for frontend security

## Testing

### Backend Testing
- **Framework**: Jest
- **Unit Tests**: `*.spec.ts` files alongside source
- **E2E Tests**: `api-v2/test/` directory
- **Coverage**: Run `npm run test:cov`

### Frontend Testing
- **Framework**: Jasmine + Karma
- **Unit Tests**: `*.spec.ts` files
- **Run**: `ng test`

### Integration Tests
- Located in `tests/` directory
- Node.js scripts for:
  - Authentication verification
  - Database connections
  - Transaction rollback testing
  - Bill number concurrency testing

## Common Patterns

### Adding a New Backend Module
1. Generate module: `nest g module modules/app/feature-name`
2. Generate controller: `nest g controller modules/app/feature-name`
3. Generate service: `nest g service modules/app/feature-name`
4. Create DTOs in `dto/` subfolder
5. Create/update entity in `entities/`
6. Register in `app.module.ts`

### Adding a New Frontend Feature
1. Generate module: `ng g module secured/feature-name`
2. Generate component: `ng g component secured/feature-name`
3. Add route to `app-routing.module.ts` or feature routing
4. Create service: `ng g service secured/feature-name/feature-name`
5. Add NgRx store if needed (actions, effects, reducers)

### Database Migrations
1. Add migration SQL in `sql/migrations/`
2. Follow naming convention: `YYYY-MM-DD-description.sql`
3. Update schema version in seed data if applicable
4. Test in development before production

## Troubleshooting

### Common Issues

**Port Already in Use**:
```bash
# Find process using port (Windows)
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

**Database Connection Issues**:
- Check PostgreSQL is running: `docker ps`
- Verify `.env` database credentials
- Check `api-v2/src/typeorm-config.service.ts` configuration

**Build Failures**:
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version matches Dockerfile
- Verify all dependencies in package.json

**Authentication Issues**:
- Check JWT secret in `.env`
- Verify token expiration settings
- Use `scripts/fix-admin-password.js` to reset admin password

## Performance Tips

1. **Database**: Use indexes for frequently queried columns
2. **API**: Enable caching for lookup data
3. **Frontend**: Use lazy loading for large modules
4. **Docker**: Use production docker-compose for optimized builds
5. **PostgreSQL**: Monitor with `pg_stat_statements` extension

## Git Workflow

Current branch: `optimize-query`
Main branch: `main`

### Commit Conventions
- Follow conventional commits format
- Prefix: feat, fix, docs, chore, refactor, test
- Example: `feat: add customer credit limit validation`

## Environment Variables

Key environment variables (see `.env.example`):
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `JWT_SECRET`, `JWT_EXPIRATION`
- `API_HOST`, `API_PORT`
- `NODE_ENV` (development/production)

## Version Information

- Node.js: 22.14.0 (backend), 16.19.0 (frontend build)
- NestJS: 11.x
- Angular: 12.2.0
- PostgreSQL: 17.4
- TypeScript: 5.7.3 (backend), 4.3.5 (frontend)

## Resources

- NestJS Docs: https://docs.nestjs.com
- Angular Docs: https://v12.angular.io/docs
- PrimeNG Components: https://www.primefaces.org/primeng-v12-lts/
- TypeORM Docs: https://typeorm.io
- NgRx Docs: https://ngrx.io

## Notes for AI Assistants

- Always check existing entity definitions before creating new ones
- Follow established module patterns for consistency
- Use TypeORM relations properly (avoid N+1 query problems)
- Validate DTOs with class-validator decorators
- Keep business logic in services, not controllers
- Use NgRx for shared state, component state for local
- Reference code by `file_path:line_number` pattern
- Check permissions/roles before implementing sensitive operations
- Use existing PrimeNG components before creating custom ones
- Follow Angular 12 conventions (not latest Angular patterns)
