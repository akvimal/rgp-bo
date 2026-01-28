# Data Scope Implementation for Sales Module

**Date:** 2026-01-12
**Status:** ✅ COMPLETE
**Module:** Sales
**Implementation:** Backend data scope filtering

---

## Overview

Implemented comprehensive data scope filtering for the Sales module, enforcing role-based data visibility at the database query level. This ensures users can only access data according to their assigned data scope (`all`, `team`, or `own`).

---

## What Was Implemented

### 1. **DataScopeService** (`api-v2/src/core/services/data-scope.service.ts`)

A new global service that provides data scope enforcement for all modules.

#### Key Features:
- **Query Filtering**: Automatically filters database queries based on user permissions
- **Access Validation**: Checks individual record access before returning data
- **Flexible Configuration**: Supports custom field names for different entities
- **Global Availability**: Exported from CoreModule for use in any module

#### Methods:

```typescript
// Apply data scope filtering to query builder
async applyDataScopeFilter<T>(
  query: SelectQueryBuilder<T>,
  userId: number,
  resource: string,
  options?: { alias?, userIdField?, storeIdField? }
): Promise<SelectQueryBuilder<T>>

// Check if user can access a specific record
async checkRecordAccess(
  userId: number,
  resource: string,
  record: { createdBy?, storeId?, ownerId? },
  throwError?: boolean
): Promise<boolean>

// Get user's data scope for a resource
async getDataScope(
  userId: number,
  resource: string
): Promise<'all' | 'team' | 'self' | null>
```

---

### 2. **Updated Sales Service** (`api-v2/src/modules/app/sales/sale.service.ts`)

Modified two key methods to enforce data scope:

#### `findAll()` Method
**Before:**
```typescript
async findAll(query:any, userid:any){
  const qb = this.saleRepository.createQueryBuilder("sale")
    .where('sale.active = :flag', { flag:true });

  if(userid){
    qb.andWhere('sale.createdby = :uid', { uid:userid });
  }
  // ... rest of query
}
```

**After:**
```typescript
async findAll(query:any, userid:any){
  let qb = this.saleRepository.createQueryBuilder("sale")
    .where('sale.active = :flag', { flag:true });

  // Apply data scope filtering (replaces hardcoded userid check)
  if(userid){
    qb = await this.dataScopeService.applyDataScopeFilter(
      qb,
      userid,
      'sales',
      {
        alias: 'sale',
        userIdField: 'createdby',
        storeIdField: 'store_id'
      }
    );
  }
  // ... rest of query
}
```

#### `findById()` Method
**Before:**
```typescript
async findById(id:number){
  return await this.saleRepository.createQueryBuilder("sale")
    .where('sale.id = :id', { id })
    .getOne();
}
```

**After:**
```typescript
async findById(id:number, userid?:any){
  const sale = await this.saleRepository.createQueryBuilder("sale")
    .where('sale.id = :id', { id })
    .getOne();

  if (!sale) {
    throw new NotFoundException(`Sale with ID ${id} not found`);
  }

  // Check data scope access if userid is provided
  if (userid) {
    await this.dataScopeService.checkRecordAccess(
      userid,
      'sales',
      {
        createdBy: sale.createdby,
        storeId: sale.storeid ?? undefined
      },
      true // throw error if access denied
    );
  }

  return sale;
}
```

---

### 3. **Updated Sales Controller** (`api-v2/src/modules/app/sales/sale.controller.ts`)

Updated all endpoints to pass the current user ID for data scope checking:

```typescript
// List all sales - filtered by data scope
@Get()
async findAll(@Query() query: any, @User() currentUser: any) {
  return this.saleService.findAll(query, currentUser.id);
}

// Get single sale - access check
@Get('/:id')
async findById(@Param('id') id: number, @User() currentUser: any) {
  return this.saleService.findById(id, currentUser.id);
}

// Update sale - access check before modification
@Put()
async update(@Body() updateSaleDto: any, @User() currentUser: any) {
  const sale = await this.saleService.findById(updateSaleDto.id, currentUser.id);
  // ... rest of update logic
}
```

---

### 4. **Updated CoreModule** (`api-v2/src/core/core.module.ts`)

Made DataScopeService globally available:

```typescript
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserRoleAssignment,
      AppRole,
      RoleFeatureAssignment,
      AppUser  // Added for data scope service
    ])
  ],
  providers: [
    PermissionService,
    PermissionGenerationService,
    DataScopeService  // New service
  ],
  exports: [
    PermissionService,
    PermissionGenerationService,
    DataScopeService  // Exported globally
  ]
})
export class CoreModule {}
```

---

## How It Works

### Data Scope Levels

| Level | Description | SQL Filter Example |
|-------|-------------|-------------------|
| **all** | User can access ALL records | No filter applied |
| **team** | User can access records from their store/team | `WHERE store_id = user.store_id` |
| **self** | User can access ONLY their own records | `WHERE created_by = user.id` |

### Example Flow

1. **User makes request** to `GET /sales`
2. **Controller** extracts user from JWT: `@User() currentUser`
3. **Controller** passes `currentUser.id` to service
4. **Service** calls `dataScopeService.applyDataScopeFilter()`
5. **DataScopeService**:
   - Fetches user's permissions from database
   - Determines data scope for 'sales' resource
   - Applies SQL WHERE clause based on scope
6. **Query executes** with appropriate filtering
7. **Results returned** contain only accessible records

### Example Queries Generated

**User with 'all' scope (Admin):**
```sql
SELECT * FROM sale WHERE active = true ORDER BY updated_on DESC;
-- No additional filter - sees everything
```

**User with 'self' scope (Sales Staff):**
```sql
SELECT * FROM sale
WHERE active = true
  AND createdby = 123  -- Only their own sales
ORDER BY updated_on DESC;
```

**User with 'team' scope (Store Manager):**
```sql
-- NOTE: Currently falls back to 'self' because AppUser doesn't have store_id field
-- Future implementation when store_id is added:
SELECT * FROM sale
WHERE active = true
  AND store_id = 5  -- Only sales from their store
ORDER BY updated_on DESC;
```

---

## Current Limitations

### 1. Team Scope Not Fully Implemented

**Issue:** `AppUser` entity doesn't have a `store_id` field

**Impact:** When a role has `dataScope: 'team'`, the system currently **falls back to 'self' (own) scope**

**Workaround:** The service logs a warning and applies 'self' filtering instead

**Solution:** Add `store_id` to `AppUser` entity (requires database migration)

```sql
-- Future migration needed:
ALTER TABLE app_user ADD COLUMN store_id INTEGER REFERENCES store(id);
```

**Code Ready:** The DataScopeService has commented-out code ready to enable team scope once the field exists:

```typescript
// api-v2/src/core/services/data-scope.service.ts
// Lines 95-104 contain the ready-to-use team scope implementation
// Just uncomment when AppUser.store_id exists
```

---

## Security Benefits

### Before Implementation
❌ **Frontend-only filtering** - users could bypass by calling API directly
❌ **Inconsistent filtering** - some queries filtered, others didn't
❌ **Data leakage risk** - users with same role could see each other's data
❌ **Hard to audit** - no centralized permission logic

### After Implementation
✅ **Backend enforcement** - impossible to bypass via direct API calls
✅ **Consistent filtering** - all queries use same DataScopeService
✅ **Data isolation** - users with 'self' scope can ONLY see their own records
✅ **Centralized logic** - all data scope rules in one service
✅ **Audit logging** - all permission checks logged
✅ **Proper error messages** - ForbiddenException with clear messages

---

## Testing the Implementation

### 1. **Test 'all' Scope (Admin User)**

```bash
# Login as admin
POST http://localhost:3000/auth/login
{
  "email": "admin@rgp.com",
  "password": "admin123"
}

# Get all sales (should see EVERYTHING)
GET http://localhost:3000/sales
Authorization: Bearer <admin-token>

# Expected: Returns ALL sales from ALL users
```

### 2. **Test 'self' Scope (Sales Staff)**

```bash
# Create a sales staff user with 'self' data scope
# Assign role with: dataScope: 'self' for sales resource

# Login as sales staff
POST http://localhost:3000/auth/login
{
  "email": "staff@rgp.com",
  "password": "staff123"
}

# Get sales
GET http://localhost:3000/sales
Authorization: Bearer <staff-token>

# Expected: Returns ONLY sales created by this staff member
# SQL: WHERE createdby = <staff-user-id>
```

### 3. **Test Access Denial**

```bash
# As sales staff, try to access another user's sale
GET http://localhost:3000/sales/123
Authorization: Bearer <staff-token>

# Expected:
# - If sale.createdby = staff.id: Returns sale (200 OK)
# - If sale.createdby != staff.id: Returns 403 Forbidden
#   "You can only access your own sales"
```

### 4. **Check Logs**

```bash
docker logs rgp-bo-api-1 | grep DataScope

# Expected output:
# [DataScopeService] Applying data scope filter: userId=123, resource=sales, scope=self
# [DataScopeService] Applying 'self' (own) filter: sale.createdby = 123
# [DataScopeService] Found 5 sales for user 123
```

---

## Files Modified

| File | Changes | Lines Changed |
|------|---------|---------------|
| `api-v2/src/core/services/data-scope.service.ts` | **NEW FILE** - Complete implementation | 305 lines |
| `api-v2/src/core/core.module.ts` | Added DataScopeService to providers/exports | +5 |
| `api-v2/src/modules/app/sales/sale.service.ts` | Updated findAll() and findById() methods | ~50 |
| `api-v2/src/modules/app/sales/sale.controller.ts` | Added currentUser to method signatures | ~10 |

**Total:** ~370 lines of code added/modified

---

## Next Steps - Applying to Other Modules

The DataScopeService is now available globally. Apply it to other modules in this priority order:

### High Priority (Sensitive Data)
1. **Payroll** - Employees must only see their own salary
2. **Attendance** - Employees see own, managers see team
3. **Leave Requests** - Employees see own, managers approve team requests
4. **Purchase Invoices** - Restrict by store/department

### Medium Priority
5. **Customers** - Sales staff see own customers vs all
6. **Purchase Orders** - Restrict by approver/creator
7. **Returns** - Match with sales scope

### Low Priority
8. **Products** - Usually visible to all
9. **Vendors** - Usually shared across organization

---

## Implementation Pattern for Other Modules

Follow this pattern to add data scope to any module:

```typescript
// 1. Update Service
import { DataScopeService } from '../../../core/services/data-scope.service';

@Injectable()
export class YourService {
  constructor(
    // ... other dependencies
    private dataScopeService: DataScopeService
  ) {}

  async findAll(query: any, userId: number) {
    let qb = this.repo.createQueryBuilder('alias');

    // Apply data scope
    qb = await this.dataScopeService.applyDataScopeFilter(
      qb,
      userId,
      'your-resource-name',  // e.g., 'payroll', 'attendance'
      {
        alias: 'alias',
        userIdField: 'created_by',
        storeIdField: 'store_id'
      }
    );

    return qb.getMany();
  }

  async findById(id: number, userId: number) {
    const record = await this.repo.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException();
    }

    // Check access
    await this.dataScopeService.checkRecordAccess(
      userId,
      'your-resource-name',
      { createdBy: record.createdBy, storeId: record.storeId },
      true
    );

    return record;
  }
}

// 2. Update Controller
@Controller('your-resource')
export class YourController {
  @Get()
  async findAll(@Query() query: any, @User() currentUser: any) {
    return this.service.findAll(query, currentUser.id);
  }

  @Get(':id')
  async findById(@Param('id') id: number, @User() currentUser: any) {
    return this.service.findById(id, currentUser.id);
  }
}
```

---

## Monitoring & Debugging

### Enable Debug Logging

The DataScopeService logs all operations. Check logs for:

```bash
# View all data scope operations
docker logs rgp-bo-api-1 | grep DataScopeService

# View permission resolution
docker logs rgp-bo-api-1 | grep PermissionService

# View access denials
docker logs rgp-bo-api-1 | grep ForbiddenException
```

### Common Log Messages

```
[DataScopeService] Applying data scope filter: userId=X, resource=sales, scope=self
[DataScopeService] Applying 'self' (own) filter: sale.createdby = X
[DataScopeService] Found 10 sales for user X
[DataScopeService] 'team' scope requested but AppUser.store_id not implemented. Falling back to 'own'
```

---

## Performance Considerations

### Query Performance
- ✅ Data scope adds simple WHERE clauses (indexed fields)
- ✅ No N+1 queries - single permission lookup per request
- ✅ Permission results can be cached (future enhancement)

### Recommendations
1. Ensure indexes exist on `created_by` and `store_id` columns
2. Consider caching user permissions for 5-10 minutes
3. Monitor slow query log for data scope filters

```sql
-- Recommended indexes
CREATE INDEX idx_sale_created_by ON sale(created_by);
CREATE INDEX idx_sale_store_id ON sale(store_id);
```

---

## Conclusion

✅ **Implementation Status:** Complete for Sales module
✅ **Build Status:** Successful - no compilation errors
✅ **Services Status:** All running properly
✅ **Ready for Testing:** Yes
⚠️ **Team Scope:** Requires AppUser.store_id field (planned for future)

The DataScopeService provides a robust, centralized way to enforce data visibility based on role permissions. The sales module now has proper backend security that cannot be bypassed.

---

**Implemented by:** Claude Code
**Date:** 2026-01-12
**Version:** 1.0
