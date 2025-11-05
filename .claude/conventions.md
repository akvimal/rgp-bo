# Coding Conventions and Standards

## General Principles

1. **Code Consistency**: Follow established patterns in the codebase
2. **Type Safety**: Leverage TypeScript for type checking
3. **DRY Principle**: Don't Repeat Yourself - extract reusable code
4. **SOLID Principles**: Especially Single Responsibility
5. **Security First**: Never compromise on security
6. **Performance Aware**: Consider performance implications

## Naming Conventions

### Files and Directories

**Backend (NestJS)**:
- Modules: `feature-name.module.ts`
- Controllers: `feature-name.controller.ts`
- Services: `feature-name.service.ts`
- Entities: `entity-name.entity.ts`
- DTOs: `create-entity.dto.ts`, `update-entity.dto.ts`
- Tests: `feature-name.spec.ts`
- E2E Tests: `feature-name.e2e-spec.ts`

**Frontend (Angular)**:
- Components: `feature-name.component.ts`, `feature-name.component.html`, `feature-name.component.scss`
- Services: `feature-name.service.ts`
- Modules: `feature-name.module.ts`
- Routing: `feature-name-routing.module.ts`
- Models: `feature-name.model.ts`
- Guards: `feature-name.guard.ts`
- Interceptors: `feature-name.interceptor.ts`
- Directives: `feature-name.directive.ts`
- Pipes: `feature-name.pipe.ts`

### Code Naming

**Classes**: PascalCase
```typescript
export class ProductService {}
export class CreateProductDto {}
export class Product extends BaseEntity {}
```

**Interfaces**: PascalCase with descriptive names
```typescript
interface ProductData {}
interface ApiResponse<T> {}
interface ProductFilterOptions {}
```

**Functions/Methods**: camelCase, descriptive verbs
```typescript
findAll()
findById(id: number)
createProduct(dto: CreateProductDto)
updateProductPrice(id: number, price: number)
```

**Variables**: camelCase, descriptive
```typescript
const productList = [];
const isActive = true;
const maxRetryCount = 3;
```

**Constants**: UPPER_SNAKE_CASE
```typescript
const MAX_UPLOAD_SIZE = 5242880; // 5MB
const DEFAULT_PAGE_SIZE = 10;
const API_BASE_URL = 'http://localhost:3000';
```

**Enums**: PascalCase for enum, UPPER_SNAKE_CASE for values
```typescript
enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK'
}
```

**Database**: snake_case
```sql
-- Tables
products
sale_items
customer_credit_accounts

-- Columns
product_id
created_at
customer_name
```

## TypeScript Conventions

### Type Annotations

**Always specify return types**:
```typescript
// Good
async findAll(): Promise<Product[]> {
  return this.productRepository.find();
}

// Avoid
async findAll() {
  return this.productRepository.find();
}
```

**Use interfaces for objects**:
```typescript
// Good
interface CreateProductRequest {
  name: string;
  price: number;
}

// Avoid
type CreateProductRequest = {
  name: string;
  price: number;
}
// (unless you need type aliases for unions/intersections)
```

**Prefer strict null checks**:
```typescript
// Good
function getProduct(id: number): Product | null {
  // ...
}

// Avoid
function getProduct(id: number): Product {
  return null; // Type error with strict mode
}
```

### Async/Await

**Prefer async/await over promises**:
```typescript
// Good
async createProduct(dto: CreateProductDto): Promise<Product> {
  const product = this.productRepository.create(dto);
  return await this.productRepository.save(product);
}

// Avoid
createProduct(dto: CreateProductDto): Promise<Product> {
  return this.productRepository.create(dto)
    .then(product => this.productRepository.save(product));
}
```

## Backend (NestJS) Conventions

### Module Structure

```typescript
// feature-name.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Entity1, Entity2]),
    // Other module imports
  ],
  controllers: [FeatureNameController],
  providers: [FeatureNameService],
  exports: [FeatureNameService], // If needed by other modules
})
export class FeatureNameModule {}
```

### Controller Conventions

```typescript
@Controller('products') // Plural noun
@UseGuards(JwtAuthGuard) // Apply auth guard if needed
@ApiTags('products') // Swagger tag
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'Returns all products' })
  async findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  async findOne(@Param('id') id: string): Promise<Product> {
    return this.productsService.findOne(+id);
  }

  @Post()
  @ApiOperation({ summary: 'Create product' })
  @ApiBody({ type: CreateProductDto })
  async create(@Body() createDto: CreateProductDto): Promise<Product> {
    return this.productsService.create(createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update product' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductDto
  ): Promise<Product> {
    return this.productsService.update(+id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(+id);
  }
}
```

### Service Conventions

```typescript
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      relations: ['vendor'],
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

### DTO Conventions

```typescript
// create-product.dto.ts
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Product Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 99.99, minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'Product description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  vendor_id: number;
}

// update-product.dto.ts
import { PartialType } from '@nestjs/swagger';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

### Entity Conventions

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int' })
  vendor_id: number;

  @ManyToOne(() => Vendor, vendor => vendor.products)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
```

## Frontend (Angular) Conventions

### Component Structure

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  // Public properties (used in template)
  products$: Observable<Product[]>;
  loading$: Observable<boolean>;
  displayDialog = false;

  // Private properties
  private subscriptions = new Subscription();

  constructor(
    private store: Store,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.initializeData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Public methods (called from template)
  onCreateProduct(): void {
    this.displayDialog = true;
  }

  onSaveProduct(product: Product): void {
    this.store.dispatch(createProduct({ product }));
    this.displayDialog = false;
  }

  // Private methods
  private initializeData(): void {
    this.products$ = this.store.select(selectAllProducts);
    this.loading$ = this.store.select(selectProductsLoading);
    this.store.dispatch(loadProducts());
  }
}
```

### Service Structure

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly apiUrl = `${environment.apiHost}/products`;

  constructor(private http: HttpClient) {}

  getProducts(filters?: ProductFilters): Observable<Product[]> {
    let params = new HttpParams();
    if (filters?.category) {
      params = params.set('category', filters.category);
    }
    return this.http.get<Product[]>(this.apiUrl, { params });
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
```

### NgRx Conventions

**Actions**:
```typescript
// Use createAction
export const loadProducts = createAction('[Products] Load Products');

export const loadProductsSuccess = createAction(
  '[Products] Load Products Success',
  props<{ products: Product[] }>()
);

export const loadProductsFailure = createAction(
  '[Products] Load Products Failure',
  props<{ error: any }>()
);

// Action naming: [Source] Action Description
// Examples:
// [Products] Load Products
// [Product Detail] Update Product
// [Product API] Load Products Success
```

**Reducers**:
```typescript
// Use createReducer with on()
export const productReducer = createReducer(
  initialState,
  on(loadProducts, state => ({
    ...state,
    loading: true,
    error: null
  })),
  on(loadProductsSuccess, (state, { products }) => ({
    ...state,
    products,
    loading: false
  })),
  on(loadProductsFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false
  }))
);
```

**Selectors**:
```typescript
// Use createSelector
export const selectProductState = createFeatureSelector<ProductState>('products');

export const selectAllProducts = createSelector(
  selectProductState,
  state => state.products
);

export const selectProductsLoading = createSelector(
  selectProductState,
  state => state.loading
);

export const selectProductById = (id: number) => createSelector(
  selectAllProducts,
  products => products.find(p => p.id === id)
);
```

## Database Conventions

### Table Names
- Lowercase, plural nouns
- Use underscores for multi-word names
- Examples: `products`, `sale_items`, `customer_credit_accounts`

### Column Names
- Lowercase, snake_case
- Be descriptive but concise
- Use standard suffixes:
  - `_id` for foreign keys
  - `_at` for timestamps
  - `_count` for counts
  - `_amount` for monetary values
  - `is_` for booleans

### Primary Keys
- Use `id` as primary key (integer, auto-increment)
- Use `SERIAL` or `BIGSERIAL` type in PostgreSQL

### Foreign Keys
- Name: `{table_name}_id`
- Always create indexes on foreign key columns
- Define ON DELETE and ON UPDATE behavior

### Timestamps
- Always include: `created_at`, `updated_at`
- Use `TIMESTAMP WITH TIME ZONE` type
- Set defaults: `DEFAULT CURRENT_TIMESTAMP`

### Example Table
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  vendor_id INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_vendor
    FOREIGN KEY (vendor_id)
    REFERENCES vendors(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_products_is_active ON products(is_active);
```

## API Design Conventions

### RESTful Endpoints

**Resource URLs** (plural nouns):
```
GET    /products           # List all products
GET    /products/:id       # Get single product
POST   /products           # Create product
PUT    /products/:id       # Update product (full)
PATCH  /products/:id       # Update product (partial)
DELETE /products/:id       # Delete product
```

**Nested Resources**:
```
GET    /vendors/:id/products       # Get products by vendor
POST   /vendors/:id/products       # Create product for vendor
```

**Query Parameters** for filtering/pagination:
```
GET /products?category=electronics&page=1&limit=10
GET /products?sort=price&order=desc
GET /products?search=laptop
```

### HTTP Status Codes

- `200 OK` - Successful GET, PUT, PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Authenticated but not authorized
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error

### Response Format

**Success Response**:
```json
{
  "id": 1,
  "name": "Product Name",
  "price": 99.99,
  "created_at": "2024-01-01T00:00:00Z"
}
```

**List Response with Pagination**:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

**Error Response**:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "price",
      "message": "Price must be a positive number"
    }
  ]
}
```

## Git Conventions

### Branch Naming
- `main` - Production branch
- `develop` - Development branch
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions

### Commit Messages

**Format**: `type(scope): description`

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance tasks

**Examples**:
```
feat(products): add product search functionality
fix(auth): resolve JWT token expiration issue
docs(api): update Swagger documentation
refactor(sales): extract sale calculation logic
test(customers): add unit tests for customer service
chore(deps): update dependencies
```

## Security Conventions

### Password Handling
```typescript
// ALWAYS hash passwords
import * as bcrypt from 'bcryptjs';

const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(plainPassword, hashedPassword);

// NEVER log passwords
console.log({ username, password }); // ❌ BAD
console.log({ username }); // ✓ GOOD
```

### JWT Tokens
```typescript
// Store secrets in environment variables
const secret = process.env.JWT_SECRET;

// Set appropriate expiration
expiresIn: '1d' // or '24h'

// Validate tokens on every protected route
@UseGuards(JwtAuthGuard)
```

### Input Validation
```typescript
// ALWAYS validate user input
@Post()
async create(@Body() createDto: CreateProductDto) {
  // DTO validation handled by ValidationPipe
}

// Use class-validator decorators
export class CreateProductDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;
}
```

### SQL Injection Prevention
```typescript
// Use TypeORM parameterized queries (automatic)
const product = await this.productRepository.findOne({
  where: { name: userInput } // ✓ Safe - parameterized
});

// NEVER use raw queries with user input
const query = `SELECT * FROM products WHERE name = '${userInput}'`; // ❌ DANGEROUS
```

## Error Handling Conventions

### Backend Errors
```typescript
// Throw specific exceptions
throw new NotFoundException('Product not found');
throw new BadRequestException('Invalid input');
throw new UnauthorizedException('Invalid credentials');

// Log errors appropriately
try {
  // ...
} catch (error) {
  this.logger.error(`Failed to create product: ${error.message}`, error.stack);
  throw new InternalServerErrorException('Failed to create product');
}
```

### Frontend Errors
```typescript
// Handle HTTP errors
this.productService.getProducts().pipe(
  catchError(error => {
    if (error.status === 404) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Not Found',
        detail: 'No products found'
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load products'
      });
    }
    return of([]);
  })
)
```

## Performance Conventions

### Database Queries
```typescript
// Load only needed relations
await this.productRepository.find({
  relations: ['vendor'], // ✓ Only what's needed
});

// Use pagination for large datasets
await this.productRepository.find({
  skip: (page - 1) * limit,
  take: limit
});

// Use select for specific columns
await this.productRepository.find({
  select: ['id', 'name', 'price']
});
```

### Frontend Performance
```typescript
// Use OnPush change detection
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})

// Use trackBy in ngFor
<tr *ngFor="let item of items; trackBy: trackById">

trackById(index: number, item: Product): number {
  return item.id;
}

// Lazy load modules
{
  path: 'feature',
  loadChildren: () => import('./feature/feature.module')
    .then(m => m.FeatureModule)
}
```

## Testing Conventions

### Test File Structure
```typescript
describe('ProductsService', () => {
  let service: ProductsService;
  let repository: Repository<Product>;

  beforeEach(async () => {
    // Setup
  });

  describe('findAll', () => {
    it('should return an array of products', async () => {
      // Arrange
      const expected = [{ id: 1, name: 'Test' }];
      jest.spyOn(repository, 'find').mockResolvedValue(expected);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(expected);
    });
  });
});
```

### Test Naming
```typescript
// Pattern: should [expected behavior] when [condition]
it('should throw NotFoundException when product does not exist')
it('should return product when valid id is provided')
it('should hash password when creating user')
```

## Documentation Conventions

### Code Comments
```typescript
// Use JSDoc for public APIs
/**
 * Creates a new product
 * @param createDto - Product data
 * @returns Created product entity
 * @throws {BadRequestException} If product data is invalid
 */
async create(createDto: CreateProductDto): Promise<Product> {
  // Implementation
}

// Use inline comments sparingly, only when necessary
// Good: Explain WHY, not WHAT
// Calculate discount based on customer tier and purchase amount
const discount = this.calculateDiscount(customer, amount);

// Bad: Stating the obvious
// Set the name
product.name = 'Test';
```

### README Files
- Include in each major feature directory
- Document purpose, usage, and examples
- Keep up to date

## Code Review Checklist

- [ ] Code follows established patterns
- [ ] Proper error handling
- [ ] Input validation
- [ ] Security considerations
- [ ] Performance implications considered
- [ ] Tests included
- [ ] Documentation updated
- [ ] No hardcoded values
- [ ] Proper logging
- [ ] TypeScript types specified
