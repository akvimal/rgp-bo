# Backend API (NestJS) - Development Guide

## Overview

This is the backend API for the RGP Back Office system, built with NestJS, TypeORM, and PostgreSQL.

**Port**: 3000 (configurable via `API_PORT`)
**Swagger Docs**: http://localhost:3000/api

## Project Structure

```
api-v2/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── typeorm-config.service.ts  # Database configuration
│   ├── core/                      # Core utilities and infrastructure
│   │   ├── decorator/             # Custom decorators
│   │   ├── exceptions/            # Custom exception classes
│   │   ├── http-exception.filter.ts  # Global exception filter
│   │   └── errors.interceptor.ts     # Error handling interceptor
│   ├── entities/                  # TypeORM entities (23 entities)
│   │   ├── base.entity.ts         # Base entity with common fields
│   │   ├── appuser.entity.ts      # User entity
│   │   ├── approle.entity.ts      # Role entity
│   │   ├── product.entity.ts      # Product entity
│   │   ├── sale.entity.ts         # Sale transaction entity
│   │   └── ...                    # 18 more entities
│   └── modules/
│       ├── auth/                  # Authentication (JWT, Passport)
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── jwt.strategy.ts
│       │   ├── local.strategy.ts
│       │   └── dto/
│       └── app/                   # Business modules
│           ├── users/             # User management
│           ├── roles/             # Role management
│           ├── products/          # Product catalog
│           ├── vendors/           # Vendor management
│           ├── customers/         # Customer management
│           ├── purchases/         # Purchase orders and invoices
│           ├── sales/             # Sales transactions
│           ├── returns/           # Sale returns
│           ├── stock/             # Inventory management
│           ├── documents/         # Document generation
│           ├── files/             # File uploads
│           ├── reports/           # Business reports
│           ├── lookup/            # Reference data
│           └── backup/            # Database backup service
├── test/                          # E2E tests
└── dist/                          # Build output
```

## Module Architecture

### Standard Module Pattern

Each feature module follows this consistent structure:

```
feature-name/
├── feature-name.module.ts       # Module definition
├── feature-name.controller.ts   # REST endpoints
├── feature-name.service.ts      # Business logic
└── dto/                         # Data Transfer Objects
    ├── create-feature.dto.ts    # Create DTO
    └── update-feature.dto.ts    # Update DTO
```

### Module Components

**Module (*.module.ts)**:
- Import required modules (TypeOrmModule for entities)
- Declare controllers and providers
- Export services if needed by other modules

**Controller (*.controller.ts)**:
- Define REST endpoints with decorators
- Use `@UseGuards(JwtAuthGuard)` for protected routes
- Handle HTTP requests and responses
- Validate request DTOs
- Delegate business logic to services

**Service (*.service.ts)**:
- Contain business logic
- Interact with database via TypeORM repositories
- Use `@InjectRepository(Entity)` for repository injection
- Handle transactions when needed
- Throw appropriate exceptions

**DTOs (dto/*.dto.ts)**:
- Use `class-validator` decorators for validation
- Use `class-transformer` for type safety
- Extend DTOs with `PartialType` or `OmitType` for updates
- Document with Swagger decorators (`@ApiProperty`)

## Entity Management

### Entity Location
All entities are in `src/entities/` directory (NOT in module folders).

### Base Entity
```typescript
// base.entity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### Entity Conventions
- Extend `BaseEntity` for common fields (id, created_at, updated_at)
- Use `@Entity()` decorator with table name
- Define relationships with appropriate decorators:
  - `@OneToMany`, `@ManyToOne`, `@ManyToMany`, `@OneToOne`
- Use `@Column()` with type and nullable options
- Define indexes for frequently queried columns

### Example Entity
```typescript
@Entity('products')
export class Product extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Vendor, vendor => vendor.products)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
```

## Authentication & Authorization

### JWT Strategy
- Location: `src/modules/auth/jwt.strategy.ts`
- Validates JWT tokens
- Extracts user from token payload
- Returns user object for request context

### Guards
```typescript
// Protect entire controller
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {}

// Protect specific route
@UseGuards(JwtAuthGuard)
@Get(':id')
findOne(@Param('id') id: string) {}
```

### Password Handling
```typescript
import * as bcrypt from 'bcryptjs';

// Hash password
const hashedPassword = await bcrypt.hash(password, 10);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### Role-Based Access Control
- Roles stored in `approle` table
- User-role relationship in `appuser` entity
- Implement custom guards for role checking

## Database Operations

### Repository Pattern
```typescript
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      relations: ['vendor'], // Load relations
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['vendor'],
    });

    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    return product;
  }

  async create(createDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createDto);
    return this.productRepository.save(product);
  }

  async update(id: number, updateDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateDto);
    return this.productRepository.save(product);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }
}
```

### Query Builder (Complex Queries)
```typescript
const products = await this.productRepository
  .createQueryBuilder('product')
  .leftJoinAndSelect('product.vendor', 'vendor')
  .where('product.price > :price', { price: 100 })
  .andWhere('vendor.name = :vendorName', { vendorName: 'ACME' })
  .orderBy('product.name', 'ASC')
  .getMany();
```

### Transactions
```typescript
@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    private dataSource: DataSource,
  ) {}

  async createSale(createDto: CreateSaleDto): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      // Create sale
      const sale = manager.create(Sale, {
        customer_id: createDto.customer_id,
        total: createDto.total,
      });
      await manager.save(sale);

      // Create sale items
      for (const item of createDto.items) {
        const saleItem = manager.create(SaleItem, {
          ...item,
          sale_id: sale.id,
        });
        await manager.save(saleItem);
      }

      return sale;
    });
  }
}
```

## Error Handling

### Exception Hierarchy
```typescript
// Built-in exceptions
throw new NotFoundException('Resource not found');
throw new BadRequestException('Invalid input');
throw new UnauthorizedException('Invalid credentials');
throw new ForbiddenException('Access denied');
throw new ConflictException('Resource already exists');
throw new InternalServerErrorException('Server error');
```

### Global Exception Filter
- Location: `src/core/http-exception.filter.ts`
- Catches all exceptions
- Returns consistent error format
- Logs errors for debugging

### Custom Exceptions
Create custom exceptions in `src/core/exceptions/`:
```typescript
export class ProductOutOfStockException extends BadRequestException {
  constructor(productId: number) {
    super(`Product #${productId} is out of stock`);
  }
}
```

## Validation

### DTO Validation
```typescript
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Widget' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Product price', example: 99.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Vendor ID', example: 1 })
  @IsNumber()
  vendor_id: number;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
```

### Validation Pipe
Enabled globally in `main.ts`:
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true, // Strip unknown properties
  forbidNonWhitelisted: true, // Reject unknown properties
  transform: true, // Transform to DTO instance
}));
```

## Swagger Documentation

### Controller Documentation
```typescript
@ApiTags('products') // Group endpoints
@Controller('products')
export class ProductsController {
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'Returns all products' })
  @Get()
  findAll() {}

  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Returns the product' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiParam({ name: 'id', type: 'number', description: 'Product ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {}
}
```

### Swagger UI
Access at: http://localhost:3000/api

## Configuration

### Environment Variables
Loaded via `@nestjs/config` in `app.module.ts`:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '../.env',
})
```

### Database Configuration
Location: `src/typeorm-config.service.ts`

```typescript
@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_DATABASE'),
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // NEVER true in production
      logging: this.configService.get('NODE_ENV') === 'development',
    };
  }
}
```

## Scheduled Tasks

### Backup Service
Location: `src/modules/app/backup/backup.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class BackupService {
  @Cron('0 0 * * *') // Daily at midnight
  async handleDailyBackup() {
    // Backup logic
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async handlePeriodicBackup() {
    // Backup logic
  }
}
```

### Cron Expression Format
```
* * * * * *
│ │ │ │ │ │
│ │ │ │ │ └─ day of week (0-7)
│ │ │ │ └─── month (1-12)
│ │ │ └───── day of month (1-31)
│ │ └─────── hour (0-23)
│ └───────── minute (0-59)
└─────────── second (0-59, optional)
```

## File Handling

### File Upload
```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  return {
    filename: file.filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}
```

### Excel Generation
```typescript
import * as ExcelJS from 'exceljs';

async generateReport(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Name', key: 'name', width: 30 },
  ];

  worksheet.addRows(data);

  return await workbook.xlsx.writeBuffer();
}
```

## Testing

### Unit Tests
```typescript
describe('ProductsService', () => {
  let service: ProductsService;
  let repository: Repository<Product>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all products', async () => {
    const products = [{ id: 1, name: 'Test' }];
    jest.spyOn(repository, 'find').mockResolvedValue(products as Product[]);

    expect(await service.findAll()).toEqual(products);
  });
});
```

### E2E Tests
```typescript
describe('ProductsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/products (GET)', () => {
    return request(app.getHttpServer())
      .get('/products')
      .expect(200)
      .expect('Content-Type', /json/);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## Commands Reference

```bash
# Development
npm run start:dev        # Hot reload development server
npm run start:debug      # Debug mode with inspector

# Build
npm run build            # Production build
npm run start:prod       # Run production build

# Code Quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting

# Testing
npm test                 # Unit tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
npm run test:e2e         # E2E tests
```

## Best Practices

1. **Services**: Keep business logic in services, not controllers
2. **DTOs**: Always validate input with class-validator
3. **Entities**: Centralize in `entities/` directory
4. **Transactions**: Use for multi-step operations
5. **Errors**: Throw specific HTTP exceptions
6. **Relations**: Load only needed relations to avoid performance issues
7. **Logging**: Use NestJS built-in Logger
8. **Security**: Always use guards for protected routes
9. **Validation**: Enable global validation pipe
10. **Documentation**: Document all endpoints with Swagger decorators

## Common Pitfalls

1. **N+1 Queries**: Always use `relations` or `leftJoinAndSelect` to load related data
2. **Synchronize**: NEVER set `synchronize: true` in production
3. **Password Hashing**: Always hash passwords, never store plain text
4. **Exception Handling**: Don't catch exceptions unless you handle them properly
5. **Circular Dependencies**: Avoid circular imports between modules
6. **Memory Leaks**: Close database connections and clear subscriptions
7. **Hardcoded Values**: Use ConfigService for environment-specific values
8. **SQL Injection**: Use parameterized queries (TypeORM handles this)

## Performance Tips

1. Use indexes on frequently queried columns
2. Use select queries to fetch only needed columns
3. Implement pagination for large datasets
4. Use caching for frequently accessed data
5. Optimize database queries with explain analyze
6. Use connection pooling (configured in TypeORM)
7. Implement batch operations for bulk inserts/updates

## Debugging

### Enable SQL Logging
Set `logging: true` in TypeORM config or:
```typescript
logging: ['query', 'error', 'schema', 'warn', 'info', 'log']
```

### Debug Port
In development mode, debug port 9229 is exposed:
```bash
# VSCode launch.json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to NestJS",
  "port": 9229
}
```

## Key Dependencies

- `@nestjs/common`, `@nestjs/core` - Core framework
- `@nestjs/typeorm`, `typeorm`, `pg` - Database
- `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt` - Auth
- `class-validator`, `class-transformer` - Validation
- `bcryptjs` - Password hashing
- `@nestjs/swagger` - API documentation
- `@nestjs/config` - Configuration
- `@nestjs/schedule` - Cron jobs
- `exceljs` - Excel generation
