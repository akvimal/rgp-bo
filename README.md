# RGP Back Office System

A comprehensive back office management system for retail pharmacy operations, built with NestJS (backend) and Angular (frontend).

## Project Structure

```
rgp-bo/
├── api-v2/          # NestJS backend API
├── frontend/        # Angular frontend application
├── sql/             # Database schema and migrations
│   ├── ddl/         # Data Definition Language files
│   │   ├── functions.sql
│   │   ├── sequences.sql
│   │   ├── tables.sql
│   │   └── views.sql
│   ├── init.sql     # Initial database setup
│   └── migrations/  # Database migration scripts
├── scripts/         # Utility scripts (backup, restore, setup)
├── tests/           # Integration and E2E tests
├── util/            # Utility tools (password generation, bulk operations)
├── docs/            # Project documentation
└── docker-compose.yml
```

## Features

- **User Management**: Role-based access control, user authentication
- **Inventory Management**: Product catalog, stock tracking, pricing
- **Sales Operations**: POS interface, billing, returns, deliveries
- **Purchase Management**: Vendor management, purchase orders, invoicing
- **Customer Management**: Customer database, credit accounts
- **Reporting**: Sales reports, GST reports, inventory reports
- **Document Management**: File uploads, PDF generation
- **Data Security**: SQL injection prevention, transaction integrity, error handling

## Technology Stack

### Backend (api-v2)
- **Framework**: NestJS 11.x
- **Language**: TypeScript
- **Database**: PostgreSQL 14
- **ORM**: TypeORM
- **Authentication**: JWT with Passport
- **Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: Angular
- **UI Components**: Bootstrap, TinyMCE

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 14

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Docker & Docker Compose
- PostgreSQL 14 (if running locally without Docker)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rgp-bo
```

2. Set up the database:
```bash
# Using Docker Compose (recommended)
docker-compose up -d postgres

# Or manually run the setup script
.\scripts\setup-test-db.bat
```

3. Install API dependencies:
```bash
cd api-v2
npm install
```

4. Configure environment variables:
```bash
# Copy and edit .env file in api-v2/
cp .env.example .env
```

5. Run database migrations:
```bash
# Execute SQL files in order
psql -U rgpapp -d rgpdb -f ../sql/init.sql
psql -U rgpapp -d rgpdb -f ../sql/ddl/tables.sql
psql -U rgpapp -d rgpdb -f ../sql/ddl/sequences.sql
psql -U rgpapp -d rgpdb -f ../sql/ddl/functions.sql
psql -U rgpapp -d rgpdb -f ../sql/ddl/views.sql
```

### Running the Application

#### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up

# Access the application
# API: http://localhost:3000
# Frontend: http://localhost:8000
# Swagger Docs: http://localhost:3000/api
```

#### Running Locally

```bash
# Terminal 1 - Start backend
cd api-v2
npm run start:dev

# Terminal 2 - Start frontend
cd frontend
npm start
```

## Development

### API Development

```bash
cd api-v2

# Development mode with hot reload
npm run start:dev

# Debug mode
npm run start:debug

# Build for production
npm run build
npm run start:prod

# Run tests
npm run test
npm run test:e2e
npm run test:cov
```

### Database Management

```bash
# Backup database
.\scripts\backup.bat

# Restore database
.\scripts\restore.bat

# Run migrations
cd sql/migrations
psql -U rgpapp -d rgpdb -f 002_fix_bill_number_race_condition.sql
```

## Testing

```bash
# Run integration tests
cd tests
node test-connection.js
node test-bill-number-concurrency.js
node test-transaction-rollback.js
node verify-via-api.js
```

See `tests/README.md` for detailed testing documentation.

## Documentation

- **Project Context (claude.md)**: Comprehensive project overview for developers and AI assistants
- **API Documentation**: Available at `/api` endpoint when running the application (Swagger UI)
- **Backend Guide**: `api-v2/README.md`
- **Error Handling Guide**: `docs/PHASE4_ERROR_HANDLING_GUIDE.md`
- **Verification Guide**: `docs/MANUAL_VERIFICATION_GUIDE.md`
- **Testing Guide**: `tests/README.md`
- **Pull Request Template**: `docs/PULL_REQUEST_TEMPLATE.md`

## Security Features

- ✅ SQL injection prevention (parameterized queries)
- ✅ Race condition handling (database-level locking)
- ✅ Transaction atomicity (SERIALIZABLE isolation)
- ✅ Global error handling and logging
- ✅ JWT-based authentication
- ✅ Role-based authorization

## Project Status

**Current Branch**: `main`

### Recent Updates
- Phase 1: SQL injection vulnerabilities eliminated
- Phase 2: Bill number race condition fixed
- Phase 3: Transaction wrappers for data integrity
- Phase 4: Comprehensive error handling infrastructure

See `docs/PHASE4_INFRASTRUCTURE_COMPLETE.md` for detailed completion status.

## Database Schema

The application uses PostgreSQL with the following main tables:
- `app_user`, `app_role` - Authentication and authorization
- `product`, `product_price2` - Product catalog and pricing
- `customer`, `customer_credit_account` - Customer management
- `vendor` - Vendor management
- `sale`, `sale_item`, `sale_delivery` - Sales operations
- `purchase_invoice`, `purchase_invoice_item` - Purchase management
- `store`, `store_cash_account` - Store and cash management

## Contributing

1. Review `claude.md` for comprehensive project context and conventions
2. Create a feature branch from `main`
3. Make your changes following the established patterns
4. Run tests and ensure they pass
5. Update documentation if needed
6. Create a pull request using the template in `docs/PULL_REQUEST_TEMPLATE.md`

## License

UNLICENSED - Private/Proprietary

## Support

For technical questions or issues, refer to:
- Technical documentation in `docs/`
- Test configuration in `tests/CONFIGURATION_GUIDE.md`
- Database migrations in `sql/migrations/`
