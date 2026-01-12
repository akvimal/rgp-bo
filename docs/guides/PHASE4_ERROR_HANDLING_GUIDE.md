# Phase 4: Comprehensive Error Handling - Implementation Guide

**Date:** October 17, 2025
**Branch:** fix/sql-injection (continuing from Phases 1-3)
**Status:** In Progress

---

## Overview

Phase 4 adds comprehensive error handling across all services to ensure:
- ✅ All database operations are wrapped in try-catch blocks
- ✅ Meaningful error messages returned to the frontend
- ✅ Comprehensive error logging for debugging
- ✅ No sensitive data leaked in error responses
- ✅ Consistent error response format

---

## Infrastructure Created

### 1. Global HTTP Exception Filter

**File:** `src/core/http-exception.filter.ts`

**Features:**
- Catches all exceptions globally
- Maps database errors to appropriate HTTP status codes
- Sanitizes error messages to prevent information leakage
- Provides structured error responses
- Logs errors at appropriate levels (error/warn/log)
- Redacts sensitive data from logs (passwords, tokens, etc.)

**PostgreSQL Error Code Mapping:**
| Code | Meaning | HTTP Status | User Message |
|------|---------|-------------|--------------|
| 23505 | Unique violation | 409 Conflict | "Duplicate value detected" |
| 23503 | Foreign key violation | 400 Bad Request | "Referenced record not found or is in use" |
| 23502 | Not null violation | 400 Bad Request | "Required field is missing" |
| 23514 | Check violation | 400 Bad Request | "Invalid value: constraint violation" |
| 22P02 | Invalid text | 400 Bad Request | "Invalid data format" |
| 40001 | Serialization failure | 409 Conflict | "Concurrent modification. Please try again" |
| 40P01 | Deadlock | 409 Conflict | "Deadlock detected. Please try again" |

**Error Response Format:**
```json
{
  "statusCode": 400,
  "timestamp": "2025-10-17T12:30:45.123Z",
  "path": "/api/customers",
  "method": "POST",
  "message": "Required field is missing",
  "error": "Bad Request"
}
```

### 2. Business Exception Classes

**File:** `src/core/exceptions/business.exception.ts`

**Custom Exceptions:**
- `BusinessException` - Base class for business rule violations (422 status)
- `StockException` - Insufficient stock errors
- `ReturnException` - Invalid return/refund errors
- `ExpiryException` - Expired product errors

**Usage Example:**
```typescript
import { StockException } from 'src/core/exceptions/business.exception';

if (availableQty < requestedQty) {
  throw new StockException(
    `Insufficient stock: ${availableQty} available, ${requestedQty} requested`
  );
}
```

### 3. Enhanced main.ts

**Changes:**
- Registered global HTTP exception filter
- Added startup logging
- Improved bootstrap logging

---

## Service Error Handling Pattern

### Standard Pattern for All Service Methods

```typescript
import { Injectable, NotFoundException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessException } from 'src/core/exceptions/business.exception';

@Injectable()
export class ExampleService {
  private readonly logger = new Logger(ExampleService.name);

  async findById(id: number) {
    try {
      const entity = await this.repository.findOne({ where: { id } });

      if (!entity) {
        throw new NotFoundException(`Entity with ID ${id} not found`);
      }

      return entity;
    } catch (error) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(`Error finding entity by ID ${id}:`, error.stack);

      // Throw generic error
      throw new HttpException(
        'Failed to retrieve entity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async create(dto: CreateDto) {
    try {
      // Validate business rules
      if (dto.someField < 0) {
        throw new BusinessException('Field cannot be negative');
      }

      // Perform database operation
      return await this.repository.save(dto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error creating entity:', error.stack);
      throw new HttpException(
        'Failed to create entity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, updates: UpdateDto) {
    try {
      // Check if exists
      const existing = await this.findById(id); // Will throw NotFoundException if not found

      // Update in transaction
      return await this.repository.manager.transaction('SERIALIZABLE', async (manager) => {
        return await manager.update(Entity, id, {...existing, ...updates});
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error updating entity ${id}:`, error.stack);
      throw new HttpException(
        'Failed to update entity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async delete(id: number) {
    try {
      // Check if exists and can be deleted
      const entity = await this.findById(id);

      // Business rule check
      if (entity.status === 'COMPLETED') {
        throw new BusinessException('Cannot delete completed entity');
      }

      // Soft delete
      return await this.repository.update(id, { active: false });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error deleting entity ${id}:`, error.stack);
      throw new HttpException(
        'Failed to delete entity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

---

## Error Handling Checklist for Each Service Method

For each service method, ensure:

- [ ] **Try-catch block** wraps all database operations
- [ ] **Not Found checks** - Throw `NotFoundException` for missing entities
- [ ] **Business rule validation** - Throw `BusinessException` for violations
- [ ] **Meaningful error messages** - User-friendly, not technical
- [ ] **Re-throw HttpExceptions** - Don't wrap already-handled exceptions
- [ ] **Log unexpected errors** - Use `this.logger.error()` with stack traces
- [ ] **Generic fallback** - Throw 500 error for unexpected failures
- [ ] **No sensitive data** - Don't include passwords, tokens in error messages
- [ ] **Transaction safety** - Critical operations wrapped in transactions

---

## Services Requiring Error Handling

### Priority 1: Critical Services (Already have transactions from Phase 3)

- [x] **sale.service.ts** - Already has transaction wrappers, add error logging
- [x] **purchase-invoice.service.ts** - Already has transaction wrappers, add error logging

### Priority 2: High-Traffic Services

- [ ] **customer.service.ts** - Add comprehensive error handling
- [ ] **product.service.ts** - Add error handling
- [ ] **stock.service.ts** - Add error handling + business rules
- [ ] **vendor.service.ts** - Add error handling

### Priority 3: Supporting Services

- [ ] **purchase.service.ts** - Add error handling
- [ ] **sale-delivery.service.ts** - Add error handling
- [ ] **saleitem.service.ts** - Add error handling (returns)
- [ ] **user.service.ts** - Add error handling
- [ ] **role.service.ts** - Add error handling
- [ ] **document.service.ts** - Add error handling
- [ ] **files.service.ts** - Add error handling
- [ ] **stock2.service.ts** - Add error handling
- [ ] **report.service.ts** - Add error handling
- [ ] **generator.service.ts** - Add error handling

---

## Common Error Scenarios and Handling

### Scenario 1: Entity Not Found

```typescript
async findById(id: number) {
  try {
    const entity = await this.repository.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`Entity with ID ${id} not found`);
    }

    return entity;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    this.logger.error(`Error finding entity ${id}:`, error.stack);
    throw new HttpException('Failed to retrieve entity', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

### Scenario 2: Duplicate Entry (Unique Constraint)

```typescript
async create(dto: CreateDto) {
  try {
    return await this.repository.save(dto);
  } catch (error) {
    // The global exception filter will catch QueryFailedError (23505)
    // and return 409 Conflict with "Duplicate value detected"
    if (error instanceof HttpException) throw error;
    this.logger.error('Error creating entity:', error.stack);
    throw new HttpException('Failed to create entity', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

### Scenario 3: Foreign Key Violation

```typescript
async delete(id: number) {
  try {
    await this.repository.delete(id);
  } catch (error) {
    // Global filter will catch 23503 and return:
    // "Referenced record not found or is in use"
    if (error instanceof HttpException) throw error;
    this.logger.error(`Error deleting entity ${id}:`, error.stack);
    throw new HttpException('Failed to delete entity', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

### Scenario 4: Business Rule Violation

```typescript
async sellProduct(productId: number, quantity: number) {
  try {
    const stock = await this.stockService.getAvailable(productId);

    if (stock.available < quantity) {
      throw new StockException(
        `Insufficient stock for product ${productId}: ${stock.available} available, ${quantity} requested`
      );
    }

    if (stock.isExpired) {
      throw new ExpiryException(`Product ${productId} has expired`);
    }

    // Proceed with sale
    return await this.createSale(productId, quantity);
  } catch (error) {
    if (error instanceof HttpException) throw error;
    this.logger.error(`Error selling product ${productId}:`, error.stack);
    throw new HttpException('Failed to process sale', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

### Scenario 5: Concurrent Modification (Serialization Failure)

```typescript
async updateSale(id: number, updates: UpdateDto) {
  try {
    return await this.repository.manager.transaction('SERIALIZABLE', async (manager) => {
      const sale = await manager.findOne(Sale, { where: { id } });

      if (!sale) {
        throw new NotFoundException(`Sale ${id} not found`);
      }

      return await manager.save(Sale, { ...sale, ...updates });
    });
  } catch (error) {
    // Global filter will catch 40001 and return:
    // "Concurrent modification detected. Please try again."
    if (error instanceof HttpException) throw error;
    this.logger.error(`Error updating sale ${id}:`, error.stack);
    throw new HttpException('Failed to update sale', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

---

## Logging Best Practices

### Log Levels

**ERROR** - Use for server errors (500):
```typescript
this.logger.error('Critical error occurred:', error.stack);
```

**WARN** - Use for client errors (400-499):
```typescript
this.logger.warn(`Invalid input: ${error.message}`);
```

**LOG** - Use for informational messages:
```typescript
this.logger.log(`Sale ${id} created successfully`);
```

**DEBUG** - Use for development debugging:
```typescript
this.logger.debug(`Processing request with params: ${JSON.stringify(params)}`);
```

### What to Log

**DO Log:**
- ✅ Error stack traces (server-side only, never to client)
- ✅ Request parameters (sanitized)
- ✅ Operation success/failure
- ✅ Performance metrics (optional)
- ✅ Business rule violations

**DON'T Log:**
- ❌ Passwords
- ❌ API keys
- ❌ Tokens
- ❌ Credit card numbers
- ❌ Personally identifiable information (unless necessary and secured)

---

## Testing Error Handling

### Manual Testing Scenarios

#### Test 1: Not Found Error
```bash
curl http://localhost:3000/api/customers/99999
# Expected: 404 with message "Customer with ID 99999 not found"
```

#### Test 2: Duplicate Entry
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"mobile": "1234567890", "name": "Test"}'

# Run again with same mobile
# Expected: 409 with message "Duplicate value: mobile"
```

#### Test 3: Foreign Key Violation
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{"customerId": 99999, "items": []}'

# Expected: 400 with message "Referenced record not found or is in use"
```

#### Test 4: Business Rule Violation
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{"customerId": 1, "items": [{"productId": 1, "quantity": 1000000}]}'

# Expected: 422 with message "Insufficient stock..."
```

### Automated Testing

Create integration tests for error scenarios:

```typescript
describe('CustomerService Error Handling', () => {
  it('should throw NotFoundException for non-existent customer', async () => {
    await expect(service.findById(99999)).rejects.toThrow(NotFoundException);
  });

  it('should throw BusinessException for invalid data', async () => {
    await expect(service.create({ mobile: '' })).rejects.toThrow(BusinessException);
  });

  it('should log errors appropriately', async () => {
    const loggerSpy = jest.spyOn(service['logger'], 'error');

    try {
      await service.findById(-1);
    } catch (e) {
      // Expected
    }

    expect(loggerSpy).toHaveBeenCalled();
  });
});
```

---

## Success Criteria

Phase 4 is complete when:

- [x] ✅ Global HTTP exception filter implemented
- [x] ✅ Custom business exception classes created
- [ ] ⬜ All service methods have try-catch blocks
- [ ] ⬜ Meaningful error messages for all scenarios
- [ ] ⬜ Comprehensive error logging (with stack traces)
- [ ] ⬜ No sensitive data in error responses
- [ ] ⬜ Consistent error response format
- [ ] ⬜ Error handling tests written

---

## Next Steps

1. **Apply error handling pattern** to all remaining services
2. **Write integration tests** for error scenarios
3. **Test error responses** manually via Postman/curl
4. **Review logs** to ensure proper logging levels
5. **Move to Phase 5** (Input Validation)

---

## Example Implementation

See `customer.service.ts`, `product.service.ts`, and `vendor.service.ts` for complete examples of proper error handling implementation.

---

**Last Updated:** October 17, 2025
**Status:** Infrastructure Complete, Service Implementation In Progress
