# RGP Back Office System - Project Context for Claude

This file provides comprehensive context about the RGP Back Office System to help Claude Code understand the project structure, conventions, and best practices.

---

## Project Overview

**RGP Back Office** is a comprehensive retail pharmacy management system built with modern web technologies. It provides complete business operations management including sales, inventory, purchases, customer management, and reporting.

### Quick Facts
- **Type**: Full-stack web application (Backend API + Frontend SPA)
- **Domain**: Retail pharmacy back office operations
- **Status**: Production-ready with ongoing security enhancements
- **License**: UNLICENSED - Private/Proprietary
- **Primary Branch**: main

---

## Technology Stack

### Backend (api-v2/)
- **Framework**: NestJS 11.x
- **Language**: TypeScript
- **Database**: PostgreSQL 17 (upgraded from 14)
- **ORM**: TypeORM
- **Authentication**: JWT with Passport
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator, class-transformer
- **Template Engine**: Handlebars (for PDF generation)

### Frontend (frontend/)
- **Framework**: Angular
- **UI Library**: Bootstrap
- **Rich Text Editor**: TinyMCE

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 17 in Docker container
- **Services**: 3 containers (postgres, api, frontend)

---

## Project Structure

```
rgp-bo/
├── api-v2/              # NestJS backend API (main backend)
│   ├── src/
│   │   ├── core/        # Cross-cutting concerns
│   │   │   ├── decorator/          # Custom decorators (@User)
│   │   │   ├── exceptions/         # Custom exception classes
│   │   │   ├── errors.interceptor.ts
│   │   │   └── http-exception.filter.ts  # Global error handling
│   │   ├── database/    # TypeORM configuration
│   │   ├── entities/    # TypeORM entity definitions
│   │   ├── modules/     # Feature modules
│   │   │   ├── auth/              # Authentication & JWT
│   │   │   ├── businesses/        # Business management
│   │   │   ├── customers/         # Customer CRUD
│   │   │   ├── documents/         # Document management
│   │   │   ├── files/             # File upload/download
│   │   │   ├── products/          # Product catalog
│   │   │   ├── purchases/         # Purchase orders & invoices
│   │   │   ├── reports/           # Report generation
│   │   │   ├── returns/           # Sales returns
│   │   │   ├── sales/             # Sales & POS operations
│   │   │   ├── stock/             # Inventory management
│   │   │   ├── users/             # User management
│   │   │   └── vendors/           # Vendor management
│   │   ├── app.module.ts
│   │   └── main.ts      # Application bootstrap
│   ├── Dockerfile
│   └── package.json
│
├── frontend/            # Angular frontend
│   ├── src/
│   │   ├── app/         # Angular application
│   │   └── assets/      # Static assets
│   ├── Dockerfile
│   └── package.json
│
├── sql/                 # Database schema and migrations
│   ├── ddl/
│   │   ├── tables.sql       # Table definitions
│   │   ├── sequences.sql    # Sequence definitions
│   │   ├── functions.sql    # PostgreSQL functions (bill number generation)
│   │   └── views.sql        # Database views
│   ├── init.sql         # Initial data (roles, admin user)
│   └── migrations/      # Database migration scripts
│       ├── 002_fix_bill_number_race_condition.sql
│       ├── 002_rollback.sql
│       ├── 003_hr_management_tables.sql
│       ├── 004_setup_test_db.sql
│       └── 005_update_hr_permissions.sql
│
├── tests/               # Integration and E2E tests
│   ├── test-bill-number-concurrency.js
│   ├── test-transaction-rollback.js
│   ├── test-connection.js
│   ├── verify-via-api.js
│   └── diagnose-auth.js
│
├── util/                # Utility scripts
│   ├── stock-bulk.js    # Bulk stock import
│   └── password-util.js # Password hashing utility
│
├── scripts/             # Operational scripts
│   ├── backup.bat       # Database backup
│   ├── restore.bat      # Database restore
│   └── setup-test-db.bat
│
├── docs/                # Project documentation
│   ├── guides/          # Implementation and development guides
│   │   ├── HR_PERFORMANCE_GUIDE.md
│   │   ├── MANUAL_VERIFICATION_GUIDE.md
│   │   └── PHASE4_ERROR_HANDLING_GUIDE.md
│   ├── planning/        # Project planning and setup documentation
│   │   ├── GITHUB_ISSUES_SETUP.md      # GitHub issues setup guide
│   │   ├── GITHUB_PROJECT_SUMMARY.md   # Project dashboard reference
│   │   └── github-issues-import.csv    # Issues import template
│   ├── archive/         # Historical documentation
│   │   ├── hr-implementation/          # HR feature planning docs
│   │   ├── implementation-summaries/   # Implementation summaries
│   │   ├── phase-completions/          # Phase completion status
│   │   ├── PHASE3_TEST_RESULTS.md
│   │   ├── PROJECT_CLEANUP_2024-11-29.md
│   │   ├── PROJECT_CLEANUP_SUMMARY_2025-12-04.md
│   │   └── VERIFICATION_RESULTS.md
│   ├── AI_API_ERROR_HANDLING.md
│   ├── ENHANCED_INVOICE_LIFECYCLE.md
│   ├── GST_REPORTING_SYSTEM_IMPLEMENTATION.md
│   ├── HSN_TAX_MANAGEMENT_GUIDE.md
│   ├── PHASE4_INFRASTRUCTURE_COMPLETE.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── READY_FOR_PULL_REQUEST.md
│   └── (other active documentation files)
│
├── docker-compose.yml   # Docker orchestration
├── README.md            # Main project documentation
└── claude.md            # This file - Claude context
```

---

## Key Business Entities

### Core Entities
1. **app_user**: System users with role-based access
2. **app_role**: User roles with fine-grained permissions (JSON)
3. **business**: Business/company information
4. **store**: Physical store locations
5. **store_cash_account**: Store cash tracking

### Product Management
6. **product**: Product catalog
7. **product_price2**: Product pricing
8. **product_pricechange**: Price history
9. **product_qtychange**: Stock movement history
10. **product_clearance**: Clearance/return processing

### Customer Management
11. **customer**: Customer records
12. **customer_credit_account**: Customer credit tracking

### Vendor Management
13. **vendor**: Vendor/supplier records
14. **vendor_payment**: Vendor payment tracking

### Purchase Operations
15. **purchase_request**: Purchase requests
16. **purchase_order**: Purchase orders
17. **purchase_invoice**: Purchase invoices
18. **purchase_invoice_item**: Invoice line items

### Sales Operations
19. **sale**: Sales transactions
20. **sale_item**: Sale line items
21. **sale_delivery**: Delivery information
22. **salereturn_item**: Return line items

### Documents
23. **document**: Document metadata and file references

### HR Management (New - Feature Branch)
24. **shift**: Work shift definitions
25. **user_shift**: User-shift assignments
26. **attendance**: Clock-in/clock-out records
27. **leave_type**: Leave type definitions
28. **leave_request**: Leave request and approval
29. **leave_balance**: Employee leave balances
30. **user_score**: Performance scoring metrics
31. **hr_audit_log**: HR operations audit trail

---

## Security & Data Integrity Features

### Implemented Security Measures

#### Phase 1: SQL Injection Prevention ✅
- **Status**: Complete
- **Implementation**: All queries use parameterized statements
- **Coverage**: 100% of SQL queries
- **Key Files**: All service files in `api-v2/src/modules/`

#### Phase 2: Race Condition Handling ✅
- **Status**: Complete
- **Implementation**: Database-level locking with `SELECT FOR UPDATE`
- **Location**: `sql/ddl/functions.sql` - `generate_bill_number()` function
- **Test**: `tests/test-bill-number-concurrency.js`
- **Protection**: Prevents duplicate bill numbers under concurrent load

#### Phase 3: Transaction Atomicity ✅
- **Status**: Complete
- **Implementation**: Transaction wrappers for multi-step operations
- **Isolation Level**: SERIALIZABLE for critical operations
- **Key Services**: sale.service.ts, purchase-invoice.service.ts
- **Test**: `tests/test-transaction-rollback.js`
- **Protection**: Prevents orphaned records (sale items without sales)

#### Phase 4: Comprehensive Error Handling ✅
- **Status**: Infrastructure complete
- **Implementation**: Global HTTP exception filter
- **Location**: `api-v2/src/core/http-exception.filter.ts`
- **Features**:
  - Automatic PostgreSQL error mapping to HTTP status codes
  - Sensitive data redaction (passwords, tokens)
  - Comprehensive server-side logging
  - Sanitized client responses
  - Custom business exception classes

### Custom Exception Classes
Located in `api-v2/src/core/exceptions/business.exception.ts`:
- **BusinessException**: Base class for business rule violations (422)
- **StockException**: Insufficient stock scenarios (422)
- **ReturnException**: Invalid return/refund operations (422)
- **ExpiryException**: Expired product handling (422)

---

## Database Schema Conventions

### Naming Conventions
- **Tables**: snake_case (e.g., `app_user`, `sale_item`)
- **Columns**: snake_case (e.g., `full_name`, `created_on`)
- **Primary Keys**: `id` (integer, auto-increment)
- **Foreign Keys**: `{table}_id` (e.g., `role_id`, `customer_id`)

### Standard Audit Columns
Most tables include:
- `created_on`: TIMESTAMP WITH TIME ZONE (default: CURRENT_TIMESTAMP)
- `updated_on`: TIMESTAMP WITH TIME ZONE (default: CURRENT_TIMESTAMP)
- `created_by`: INTEGER (references app_user.id)
- `updated_by`: INTEGER (references app_user.id)
- `active`: BOOLEAN (default: true)
- `archive`: BOOLEAN (default: false)

### Critical Database Functions
- **generate_bill_number()**: Generates sequential bill numbers with row-level locking
  - Uses `SELECT FOR UPDATE` to prevent race conditions
  - Location: `sql/ddl/functions.sql`
  - Called from: sale.service.ts

---

## Backend Code Conventions

### Service Method Pattern

#### Standard CRUD Method Structure
```typescript
async methodName(dto: Dto, userId: number): Promise<ReturnType> {
  try {
    // 1. Validate business rules
    if (someCondition) {
      throw new BusinessException('Business rule violation message');
    }

    // 2. Perform database operation
    const result = await this.repository.save(entity);

    // 3. Return result
    return result;

  } catch (error) {
    // 4. Error handling
    if (error instanceof HttpException) throw error;
    this.logger.error('Error in methodName:', error.stack);
    throw new HttpException('Operation failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

#### Transaction Pattern for Multi-Step Operations
```typescript
async create(dto: CreateDto, userId: number): Promise<Entity> {
  return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
    try {
      // All operations within transaction
      const entity = await manager.save(Entity, data);
      const items = await manager.save(EntityItem, itemsData);
      return entity;
    } catch (error) {
      // Error automatically rolls back transaction
      throw new Error(`Failed to create: ${error.message}`);
    }
  });
}
```

### Authentication & Authorization
- **Authentication**: JWT tokens via Passport strategy
- **Decorator**: `@User()` extracts user from request
- **Guard**: `@UseGuards(JwtAuthGuard)` protects routes
- **Location**: `api-v2/src/modules/auth/`

### Swagger Documentation
- All DTOs use class-validator decorators
- Controllers use Swagger decorators (@ApiTags, @ApiOperation, @ApiResponse)
- Accessible at: `http://localhost:3000/api`

---

## Test Users & Authentication

### Default Test User
- **Email**: `admin@rgp.com`
- **Password**: `admin123`
- **Role**: Admin (full access)
- **Location**: Database initialized via `sql/init.sql`

### Roles & Permissions
1. **Admin** (ID: 1)
   - Full system access
   - User and role management
   - All business operations

2. **Sales Staff** (ID: 2)
   - Sales operations
   - Customer viewing
   - Limited stock access (no cost visibility)

3. **Store Head** (ID: 3)
   - Store management
   - Stock and cash management
   - Sales and purchase operations
   - Limited admin functions

---

## Running the Application

### Using Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker logs rgp-bo-api-1
docker logs rgp-db
docker logs rgp-bo-frontend-1

# Stop services
docker-compose down
```

### Service URLs
- **Frontend**: http://localhost:8000
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api
- **Database**: localhost:5432
- **Redis Cache**: localhost:6379

### Database Access
```bash
# Connect to database
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# Run SQL file
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/init.sql
```

### Manual Development Mode
```bash
# Terminal 1 - Start API
cd api-v2
npm install
npm run start:dev

# Terminal 2 - Start Frontend
cd frontend
npm install
npm start
```

---

## Testing Strategy

### Integration Tests
Located in `tests/` directory:
- **test-connection.js**: Database connectivity
- **test-bill-number-concurrency.js**: Phase 2 race condition tests
- **test-transaction-rollback.js**: Phase 3 transaction integrity tests
- **verify-via-api.js**: API-based verification
- **diagnose-auth.js**: Database authentication diagnostics

### Running Tests
```bash
cd tests
npm install
node test-bill-number-concurrency.js
node test-transaction-rollback.js
```

### Manual Testing
- Use Swagger UI at http://localhost:3000/api
- Import Postman collection (if available)
- Login to get JWT token, use in Authorization header: `Bearer <token>`

---

## Common Development Tasks

### Adding a New Module
1. Generate module: `nest g module modules/app/my-module`
2. Generate controller: `nest g controller modules/app/my-module`
3. Generate service: `nest g service modules/app/my-module`
4. Create entity in `entities/my-entity.entity.ts`
5. Create DTOs in `modules/app/my-module/dto/`
6. Implement service methods with error handling pattern
7. Add Swagger decorators to controller
8. Register module in `app.module.ts`

### Database Schema Changes
1. Update SQL files in `sql/ddl/`
2. Create migration in `sql/migrations/`
3. Test migration on development database
4. Update TypeORM entities
5. Document changes in migration file

### Adding Business Logic Validation
1. Use custom exception classes from `core/exceptions/`
2. Validate in service layer, not controller
3. Throw specific exceptions (StockException, ReturnException, etc.)
4. Let global filter handle the response

---

## Important Files to Review When Starting

### For Backend Development
1. `api-v2/src/main.ts` - Application bootstrap
2. `api-v2/src/app.module.ts` - Module configuration
3. `api-v2/src/core/http-exception.filter.ts` - Error handling
4. `api-v2/src/modules/app/sales/sale.service.ts` - Example service with transactions
5. `docs/guides/PHASE4_ERROR_HANDLING_GUIDE.md` - Error handling patterns

### For Database Work
1. `sql/ddl/tables.sql` - Table definitions
2. `sql/ddl/functions.sql` - Critical functions (bill number generation)
3. `sql/init.sql` - Initial data setup
4. `sql/migrations/` - Schema changes and updates
5. `docker-compose.yml` - Database configuration

### For Testing
1. `tests/README.md` - Testing guide
2. `tests/test-config.js` - Database connection config
3. `docs/guides/MANUAL_VERIFICATION_GUIDE.md` - Manual testing procedures

### For HR Features (Feature Branch)
1. `sql/migrations/003_hr_management_tables.sql` - HR database schema
2. `api-v2/src/modules/hr/` - HR module implementation
3. `frontend/src/app/secured/hr/` - HR frontend components
4. `docs/guides/HR_PERFORMANCE_GUIDE.md` - HR implementation guide
5. `docs/archive/hr-implementation/` - HR planning documentation

---

## Known Issues & Considerations

### Database Version
- **PostgreSQL Version**: Updated to 17 (was 14)
- **Reason**: Existing volume was initialized with PostgreSQL 17
- **Impact**: docker-compose.yml updated to use postgres:17 image
- **Compatibility**: No breaking changes, all features work correctly

### Phase 4 Service Implementation
- Global error handling infrastructure is complete
- Pattern needs to be applied to all 16 services (~124 methods)
- Priority services: sale, purchase-invoice, customer, product, stock
- See: `docs/PHASE4_ERROR_HANDLING_GUIDE.md` for implementation checklist

### Environment Variables
- JWT_KEY should be changed in production
- FILEUPLOAD_LOCATION requires proper permissions
- DATABASE_URL uses host.docker.internal for Docker API to local DB

---

## Git Workflow & Branch Strategy

### Current Branch
- **main**: Production-ready code
- **Recent Work**: Security enhancements (Phases 1-4)

### Recent Commits (from git log)
```
2ab82b21e - Merge pull request #42 from akvimal/fix/sql-injection
951daaee9 - docs: Add comprehensive Pull Request documentation
5f6df6b83 - docs: Add Phase 4 infrastructure completion summary
6c2de1482 - feat: [Phase 4] Add comprehensive error handling infrastructure
f3ec402c2 - docs: Add comprehensive verification and diagnostic documentation
```

### Pull Request Process
1. Create feature branch from main
2. Make changes following existing patterns
3. Run tests (`npm run test`, integration tests)
4. Update documentation if needed
5. Use template from `docs/PULL_REQUEST_TEMPLATE.md`
6. Submit PR for review

---

## Performance Considerations

### Database Optimization
- Indexes on frequently queried columns (email, bill_no, etc.)
- Transaction isolation level SERIALIZABLE for critical operations
- Row-level locking for bill number generation prevents contention

### API Performance
- JWT authentication reduces database lookups
- Redis caching for frequently accessed data
- TypeORM query optimization with eager/lazy loading
- Proper use of transactions to minimize lock duration

### Monitoring & Logging
- System performance monitoring (query times, API response times)
- API usage logging for analytics
- All errors logged with full context
- Sensitive data automatically redacted
- Server logs include request details for debugging

---

## Documentation Structure

### Main Documentation
- **README.md**: Project overview, setup, running
- **CLAUDE.md**: This file - comprehensive context for Claude
- **api-v2/README.md**: Backend-specific documentation

### Technical Guides (`docs/guides/`)
- **PHASE4_ERROR_HANDLING_GUIDE.md**: Error handling patterns
- **MANUAL_VERIFICATION_GUIDE.md**: Manual testing procedures
- **HR_PERFORMANCE_GUIDE.md**: HR features performance optimization

### Active Documentation (`docs/`)
- **ENHANCED_INVOICE_LIFECYCLE.md**: Enhanced invoice lifecycle system
- **GST_REPORTING_SYSTEM_IMPLEMENTATION.md**: GST reporting implementation
- **HSN_TAX_MANAGEMENT_GUIDE.md**: HSN code and tax management
- **GST_FILING_AND_ITC_GUIDE.md**: GST filing and ITC reconciliation
- **SMART_PO_IMPLEMENTATION_ROADMAP.md**: Smart purchase order roadmap
- **NEXT_ACTIONS_ROADMAP.md**: Project roadmap and next actions
- **MULTI_TENANT_STORE_ARCHITECTURE.md**: Multi-store architecture
- **INVOICE_DOCUMENT_UPLOAD_OCR.md**: Invoice OCR capabilities
- **PRICING_TAX_ANALYSIS_RECOMMENDATIONS.md**: Pricing and tax analysis
- **GST_2025_IMPACT_ANALYSIS.md**: GST 2025 impact analysis
- **AI_API_ERROR_HANDLING.md**: AI API error handling patterns
- **PULL_REQUEST_TEMPLATE.md**: PR submission template
- **READY_FOR_PULL_REQUEST.md**: PR readiness checklist

### Historical Documentation (`docs/archive/`)
- **phase-completions/**: Phase completion status documents
  - PHASE1_HSN_TAX_IMPLEMENTATION_COMPLETE.md
  - PHASE2_ADVANCED_PRICING_COMPLETE.md
  - PHASE3_COMPLETION_STATUS.md
  - PHASE4_INFRASTRUCTURE_COMPLETE.md
- **implementation-summaries/**: Implementation summary documents
  - AI_API_NOTIFICATION_IMPLEMENTATION.md
  - GST_REPORTING_FRONTEND_IMPLEMENTATION_COMPLETE.md
  - GST_REPORTING_IMPLEMENTATION_SUMMARY.md
  - HSN_TAX_IMPLEMENTATION_SUMMARY.md
  - MULTI_PRODUCT_INTENT_IMPLEMENTATION.md
- **hr-implementation/**: HR feature planning and implementation documentation
- **PROJECT_CLEANUP_2024-11-29.md**: Previous cleanup summary (Nov 2024)
- **PROJECT_CLEANUP_SUMMARY_2025-12-04.md**: Previous cleanup summary (Dec 2024)
- **PHASE3_TEST_RESULTS.md**: Phase 3 test results
- **VERIFICATION_RESULTS.md**: General verification results

### Testing Documentation (`tests/`)
- **README.md**: Comprehensive testing guide with all test files listed
- **CONFIGURATION_GUIDE.md**: Test configuration guide
- **PHASE3_TESTING.md**: Phase 3 transaction rollback testing
- **ENHANCED_INVOICE_LIFECYCLE_TESTING.md**: Enhanced invoice lifecycle testing guide

---

## Quick Reference Commands

### Docker Operations
```bash
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose ps                 # Check status
docker-compose logs -f api        # Follow API logs
docker-compose restart api        # Restart API service
```

### Database Operations
```bash
# Connect to database
docker exec -it rgp-db psql -U rgpapp -d rgpdb

# Execute SQL file
docker exec -i rgp-db psql -U rgpapp -d rgpdb < sql/file.sql

# Backup database
docker exec rgp-db pg_dump -U rgpapp rgpdb > backup.sql

# Restore database
docker exec -i rgp-db psql -U rgpapp -d rgpdb < backup.sql
```

### Development
```bash
# API Development
cd api-v2
npm run start:dev                 # Hot reload
npm run start:debug               # Debug mode
npm run build                     # Build for production

# Frontend Development
cd frontend
npm start                         # Development server
npm run build                     # Production build
```

### Testing
```bash
cd tests
node test-connection.js           # Test DB connection
node test-bill-number-concurrency.js  # Phase 2 tests
node test-transaction-rollback.js     # Phase 3 tests
```

---

## Contact & Support

For questions or issues:
1. Review documentation in `docs/`
2. Check test files for examples in `tests/`
3. Review similar implementations in existing services
4. Refer to NestJS documentation: https://docs.nestjs.com

---

**Last Updated**: 2025-12-17
**Maintainer**: Development Team
**Claude Code Version**: This context is optimized for Claude Code

---

## Recent Changes (2026-01-13)

### Project Cleanup & Organization (January 2026)
- **Temporary files removed**: Cleaned up 42 temporary Claude working directory files
  - Removed all `tmpclaude-*-cwd` files from root directory (40 files)
  - Removed all `tmpclaude-*-cwd` files from api-v2 directory (2 files)
  - Added pattern to `.gitignore` to prevent future commits

- **Log files cleaned**: Removed development log files
  - Removed `backend.log` (1.5MB) - already in .gitignore pattern

- **Obsolete files removed**:
  - Removed `frontend/Dockerfile.old` (outdated Docker configuration)

- **Planning documentation organized**: Created new `docs/planning/` directory
  - Moved `GITHUB_ISSUES_SETUP.md` → `docs/planning/`
  - Moved `GITHUB_PROJECT_SUMMARY.md` → `docs/planning/`
  - Moved `github-issues-import.csv` → `docs/planning/`

- **Project structure updated**: CLAUDE.md updated to reflect new organization

### Previous Changes (2025-12-17)

#### Project Cleanup & Organization (December 2025)
- **Root directory cleaned**: Moved 6 implementation documents from root to `docs/`
  - AI_API_NOTIFICATION_IMPLEMENTATION.md
  - GST_REPORTING_IMPLEMENTATION_SUMMARY.md
  - MULTI_PRODUCT_INTENT_IMPLEMENTATION.md
  - NEXT_ACTIONS_ROADMAP.md
  - PHASE3_COMPLETION_STATUS.md
  - PHASE3_TEST_RESULTS.md

- **Documentation archived**: Enhanced organization with new archive subdirectories
  - `docs/archive/phase-completions/` - Phase 1-4 completion status documents
  - `docs/archive/implementation-summaries/` - Implementation summary documents
  - Previous cleanup summaries moved to archive

- **Test documentation improved**:
  - Renamed PHASE3_TESTING_README.md → ENHANCED_INVOICE_LIFECYCLE_TESTING.md (more descriptive)
  - Updated tests/README.md with comprehensive test file listing organized by category

- **Redundant files removed**:
  - sql/migrations/006_enhanced_invoice_lifecycle.sql.backup (redundant backup)

### Previous Changes (2025-12-04)

#### Project Cleanup & Organization
- **Documentation reorganized**: Created `docs/guides/` for active guides and `docs/archive/` for historical docs
- **HR documentation archived**: 7 HR implementation planning docs moved to `docs/archive/hr-implementation/`
- **SQL migrations organized**: Moved `setup-test-db.sql` and `update_hr_permissions.sql` to `sql/migrations/`
- **System files cleaned**: Removed `.DS_Store` files (already in .gitignore)
- **Infrastructure updates**: Added Redis cache service, monitoring, and performance logging entities

#### New Features (Feature Branch: feature/hr-management)
- **HR Management Module**: Shift management, leave tracking, attendance, performance scoring
- **Monitoring & Caching**: Redis integration, API usage logging, query performance tracking
- **Database Schema**: 8 new HR-related entities with comprehensive audit trails
