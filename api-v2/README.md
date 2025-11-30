# RGP Backend API v2

The main NestJS backend API for the RGP Back Office System.

## Overview

This is a production-ready NestJS application that provides RESTful APIs for managing retail pharmacy operations including sales, purchases, inventory, customers, and reporting.

## Technology Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript
- **Database**: PostgreSQL 14
- **ORM**: TypeORM
- **Authentication**: JWT with Passport
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator, class-transformer

## Project Structure

```
src/
├── core/                    # Core utilities and decorators
│   ├── decorator/          # Custom decorators (e.g., @User())
│   ├── exceptions/         # Custom exception classes
│   ├── errors.interceptor.ts
│   └── http-exception.filter.ts
├── entities/               # TypeORM entities
├── modules/
│   ├── auth/              # Authentication & JWT
│   └── app/               # Business modules
│       ├── customers/     # Customer management
│       ├── documents/     # Document management
│       ├── files/         # File upload handling
│       ├── products/      # Product catalog
│       ├── purchases/     # Purchase orders & invoices
│       ├── reports/       # Reporting services
│       ├── returns/       # Sales returns
│       ├── roles/         # Role management
│       ├── sales/         # Sales & POS
│       ├── stock/         # Inventory management
│       ├── users/         # User management
│       └── vendors/       # Vendor management
├── typeorm-config.service.ts
├── app.module.ts
└── main.ts
```

## Installation

```bash
npm install
```

## Environment Configuration

Create a `.env` file in this directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://rgpapp:password@localhost:5432/rgpdb
LOG_SQL=false

# JWT
JWT_KEY=your-secret-key
JWT_EXPIRES=24h

# Server
PORT=3000
NODE_ENV=development

# File Upload
FILEUPLOAD_LOCATION=/path/to/upload
FILEUPOAD_SIZE_LIMIT=512000
```

## Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Debug mode
npm run start:debug

# Production mode
npm run start:prod
```

## API Documentation

When the application is running, access the Swagger UI at:
```
http://localhost:3000/api
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

For integration testing, see the `tests/` directory in the project root.

## Database Setup

The application requires PostgreSQL 14. Database schema is defined in the `sql/` directory at project root:

1. Run initial setup: `sql/init.sql`
2. Create tables: `sql/ddl/tables.sql`
3. Create sequences: `sql/ddl/sequences.sql`
4. Create functions: `sql/ddl/functions.sql`
5. Create views: `sql/ddl/views.sql`

## Key Features

### Security
- SQL injection prevention with parameterized queries
- Race condition handling for bill number generation
- Transaction isolation (SERIALIZABLE level for critical operations)
- Global HTTP exception filtering
- JWT-based authentication with role-based access control

### Business Logic
- **Sales**: POS operations, billing, deliveries, returns
- **Purchases**: Vendor management, purchase orders, invoicing
- **Inventory**: Stock tracking, pricing, quantity adjustments
- **Customers**: Customer database, credit accounts, reminders
- **Reports**: Sales reports, GST reports, inventory reports
- **Documents**: File uploads, PDF generation (bills, reports)

### Error Handling
The application uses a global HTTP exception filter that:
- Standardizes error responses
- Logs errors with appropriate detail levels
- Prevents information leakage in production
- Handles database errors gracefully

See `docs/PHASE4_ERROR_HANDLING_GUIDE.md` for details.

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Business Modules
- `/customers` - Customer CRUD operations
- `/products` - Product catalog management
- `/sales` - Sales operations and POS
- `/purchases` - Purchase orders and invoices
- `/stock` - Inventory management
- `/vendors` - Vendor management
- `/reports` - Report generation
- `/documents` - Document management
- `/files` - File upload/download

All endpoints except `/auth/login` require JWT authentication.

## Development Guidelines

### Adding a New Module

1. Generate module: `nest g module modules/app/my-module`
2. Generate controller: `nest g controller modules/app/my-module`
3. Generate service: `nest g service modules/app/my-module`
4. Create DTOs in `dto/` subfolder
5. Add business logic to service
6. Use transactions for multi-step operations
7. Add Swagger decorators for API documentation

### Transaction Best Practices

For operations that modify multiple tables:

```typescript
async createSale(dto: CreateSaleDto): Promise<Sale> {
  return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
    // All database operations here
    const sale = await manager.save(Sale, saleData);
    await manager.save(SaleItem, items);
    return sale;
  });
}
```

### Error Handling

Throw appropriate exceptions:

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BusinessException } from '../../core/exceptions/business.exception';

// For not found resources
throw new NotFoundException('Customer not found');

// For business logic violations
throw new BusinessException('Insufficient stock');

// For validation errors
throw new BadRequestException('Invalid input');
```

## Building for Production

```bash
# Build the application
npm run build

# Run in production mode
npm run start:prod
```

The built application will be in the `dist/` directory.

## Docker Support

The application includes a Dockerfile for containerization. Use the docker-compose.yml in the project root to run the entire stack:

```bash
cd ..
docker-compose up
```

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check firewall settings

### JWT Authentication Issues
- Verify JWT_KEY is set
- Check token expiration (JWT_EXPIRES)
- Ensure Authorization header format: `Bearer <token>`

### File Upload Issues
- Check FILEUPLOAD_LOCATION exists and is writable
- Verify FILEUPOAD_SIZE_LIMIT is appropriate
- Ensure multer configuration in files module

## Migration from api (v1)

This version includes:
- Updated to NestJS 11.x
- Enhanced security features
- Improved error handling
- Better transaction management
- Updated dependencies

## Contributing

1. Create a feature branch
2. Follow the existing code structure
3. Add tests for new features
4. Update Swagger documentation
5. Submit a pull request

## License

UNLICENSED - Private/Proprietary
