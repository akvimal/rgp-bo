# Dynamic RBAC with Multitenancy - Design Document

**Date:** 2026-01-11
**Version:** 1.0
**Status:** Design Proposal

---

## Executive Summary

Design for **dynamic role-permission management** with **multitenancy support**, building on the existing flexible JSON permission system.

### Goals
1. ✅ **Dynamic Permissions** - Owners/Managers can configure role permissions via UI
2. ✅ **Multiple Roles per User** - Users can have multiple roles (e.g., "Manager" + "Pharmacist")
3. ✅ **Multitenancy Ready** - Tenant-scoped roles and permissions
4. ✅ **Permission Inheritance** - Compose permissions from multiple sources
5. ✅ **Backward Compatible** - Works with existing JSON structure

---

## Current System Strengths (Keep These!)

### ✅ Flexible JSON Permission Model
```json
{
  "resource": "sales",
  "path": ["/secure/sales"],
  "data": "all",
  "policies": [
    {"action": "read", "properties": []},
    {"action": "create", "properties": []}
  ]
}
```

**Why it's perfect for dynamic configuration:**
- JSON structure = easy to modify via UI
- No code changes needed to add/remove permissions
- Self-describing (resource, action, path all explicit)
- Already supports field-level permissions

---

## Enhanced Database Schema for Multitenancy

### Phase 1: Current Schema (No Changes Needed)

```sql
-- Current tables (keep as-is)
CREATE TABLE app_role (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  permissions JSON,  -- Flexible JSON permissions
  locked BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  archive BOOLEAN DEFAULT false,
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200),
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255),
  role_id INTEGER REFERENCES app_role(id),  -- Single role (current)
  active BOOLEAN DEFAULT true,
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Phase 2: Multi-Role Support (Backward Compatible)

```sql
-- New table for multiple role assignments
CREATE TABLE user_role_assignment (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES app_user(id),
  assigned_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true,

  -- Prevent duplicate assignments
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_role_user ON user_role_assignment(user_id) WHERE active = true;
CREATE INDEX idx_user_role_role ON user_role_assignment(role_id) WHERE active = true;

-- Migration: Populate from existing app_user.role_id
INSERT INTO user_role_assignment (user_id, role_id, assigned_by)
SELECT id, role_id, 1 FROM app_user WHERE role_id IS NOT NULL;

-- Keep app_user.role_id for backward compatibility (primary role)
-- New code will use user_role_assignment for multiple roles
```

---

### Phase 3: Multitenancy Support

```sql
-- Tenant master table
CREATE TABLE tenant (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',  -- active, suspended, inactive
  settings JSONB,  -- Tenant-specific settings
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenant-specific roles (inherits from global + adds tenant-specific)
CREATE TABLE tenant_role (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  base_role_id INTEGER REFERENCES app_role(id),  -- NULL = tenant-custom role
  name VARCHAR(100) NOT NULL,
  permissions JSON NOT NULL,
  is_custom BOOLEAN DEFAULT false,  -- true = created by tenant
  active BOOLEAN DEFAULT true,
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tenant_role_tenant ON tenant_role(tenant_id) WHERE active = true;

-- User-tenant associations (users can belong to multiple tenants)
CREATE TABLE user_tenant (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  default_tenant BOOLEAN DEFAULT false,
  joined_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true,

  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_user_tenant_user ON user_tenant(user_id) WHERE active = true;
CREATE INDEX idx_user_tenant_tenant ON user_tenant(tenant_id) WHERE active = true;

-- Tenant-scoped user role assignments
CREATE TABLE tenant_user_role (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES tenant_role(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES app_user(id),
  assigned_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true,

  UNIQUE(tenant_id, user_id, role_id)
);

CREATE INDEX idx_tenant_user_role_lookup ON tenant_user_role(tenant_id, user_id) WHERE active = true;
```

---

## Permission Resolution Strategy

### Scenario 1: Single Tenant, Multiple Roles (Current + Phase 2)

**User:** John (roles: "Manager" + "Pharmacist")

**Permission Resolution:**
1. Load all active roles for user from `user_role_assignment`
2. Merge permissions from all roles
3. Union of permissions (most permissive wins)

```typescript
function resolveUserPermissions(userId: number): Permission[] {
  // Get all active role assignments
  const roleAssignments = await userRoleAssignmentRepo.find({
    where: { user_id: userId, active: true },
    relations: ['role']
  });

  // Collect all permissions from all roles
  const allPermissions = [];
  for (const assignment of roleAssignments) {
    allPermissions.push(...assignment.role.permissions);
  }

  // Merge permissions (union)
  return mergePermissions(allPermissions);
}

function mergePermissions(permissions: Permission[]): Permission[] {
  const merged = new Map<string, Permission>();

  for (const perm of permissions) {
    const key = perm.resource;

    if (!merged.has(key)) {
      merged.set(key, { ...perm });
    } else {
      // Merge policies and paths
      const existing = merged.get(key);
      existing.path = unionArrays(existing.path, perm.path);
      existing.policies = mergePolicies(existing.policies, perm.policies);

      // Data scope: 'all' wins over 'self'
      if (perm.data === 'all') {
        existing.data = 'all';
      }
    }
  }

  return Array.from(merged.values());
}
```

**Example Result:**
```json
// Manager role permissions
{
  "resource": "sales",
  "data": "all",
  "policies": [
    {"action": "read"},
    {"action": "approve"}
  ]
}

// Pharmacist role permissions
{
  "resource": "sales",
  "data": "self",
  "policies": [
    {"action": "read"},
    {"action": "create"}
  ]
}

// Merged permissions (union)
{
  "resource": "sales",
  "data": "all",  // Manager's "all" wins
  "policies": [
    {"action": "read"},
    {"action": "create"},  // From Pharmacist
    {"action": "approve"}  // From Manager
  ]
}
```

---

### Scenario 2: Multitenancy with Tenant-Specific Roles

**User:** Sarah (Tenant A: "Manager", Tenant B: "Pharmacist")

**Permission Resolution:**
1. Determine current tenant context (from request header or session)
2. Load tenant-specific role assignments
3. Merge permissions from tenant roles

```typescript
function resolveUserPermissions(
  userId: number,
  tenantId: number
): Permission[] {
  // Get tenant-specific role assignments
  const roleAssignments = await tenantUserRoleRepo.find({
    where: {
      tenant_id: tenantId,
      user_id: userId,
      active: true
    },
    relations: ['role']
  });

  // Tenant roles can inherit from global roles
  const allPermissions = [];
  for (const assignment of roleAssignments) {
    const role = assignment.role;

    // If tenant role is based on global role, merge both
    if (role.base_role_id) {
      const baseRole = await appRoleRepo.findOne(role.base_role_id);
      allPermissions.push(...baseRole.permissions);
    }

    // Add tenant-specific permissions
    allPermissions.push(...role.permissions);
  }

  return mergePermissions(allPermissions);
}
```

---

## JWT Token Structure for Multitenancy

### Enhanced JWT Payload

```typescript
interface JwtPayload {
  id: number;              // User ID
  email: string;           // User email
  tenant_id: number;       // Current tenant context
  tenant_code: string;     // Tenant code (for display)
  role_ids: number[];      // All role IDs for user (in current tenant)
  permissions: Permission[]; // Merged permissions (pre-computed)

  // Optional: for multi-tenant switching
  tenants?: Array<{
    id: number;
    code: string;
    name: string;
    default: boolean;
  }>;
}
```

**Example:**
```json
{
  "id": 123,
  "email": "john@pharmacy.com",
  "tenant_id": 1,
  "tenant_code": "PHARMA_CENTRAL",
  "role_ids": [3, 5],  // Manager + Pharmacist
  "permissions": [
    {
      "resource": "sales",
      "path": ["/secure/sales"],
      "data": "all",
      "policies": [
        {"action": "read"},
        {"action": "create"},
        {"action": "approve"}
      ]
    }
  ],
  "tenants": [
    {"id": 1, "code": "PHARMA_CENTRAL", "name": "Central Pharmacy", "default": true},
    {"id": 2, "code": "PHARMA_WEST", "name": "West Branch", "default": false}
  ]
}
```

---

## Dynamic Permission Management API

### Admin APIs for Permission Configuration

```typescript
// 1. Get all available resources and actions
@Controller('admin/permissions')
@UseGuards(AuthGuard, RbacGuard)
export class PermissionAdminController {

  // Get permission schema (all available resources)
  @Get('schema')
  @RequirePermission('administration.manage_permissions')
  async getPermissionSchema(): Promise<PermissionSchema> {
    return {
      resources: [
        {
          name: 'sales',
          display: 'Sales & Customer Management',
          actions: [
            { name: 'read', display: 'View Sales' },
            { name: 'create', display: 'Create Sales' },
            { name: 'edit', display: 'Edit Sales' },
            { name: 'delete', display: 'Delete Sales' },
            { name: 'approve', display: 'Approve Sales' }
          ],
          paths: [
            '/secure/sales',
            '/secure/sales/pos',
            '/secure/sales/list'
          ],
          sensitiveFields: ['cost', 'margin', 'profit'],
          dataScopes: ['all', 'team', 'self']
        },
        {
          name: 'payroll',
          display: 'Payroll Processing',
          actions: [
            { name: 'read', display: 'View Payroll' },
            { name: 'create', display: 'Create Payroll Run' },
            { name: 'calculate', display: 'Calculate Payroll' },
            { name: 'approve', display: 'Approve Payroll' }
          ],
          paths: ['/secure/payroll'],
          sensitiveFields: ['salary', 'deductions', 'net_pay'],
          dataScopes: ['all', 'self']
        }
        // ... all other resources
      ]
    };
  }

  // 2. Update role permissions (dynamic)
  @Put('roles/:roleId/permissions')
  @RequirePermission('administration.manage_permissions')
  async updateRolePermissions(
    @Param('roleId') roleId: number,
    @Body() dto: UpdatePermissionsDto,
    @User() currentUser: any
  ): Promise<AppRole> {
    // Validate permissions against schema
    this.validatePermissions(dto.permissions);

    // Update role
    const role = await this.roleRepo.findOne(roleId);

    if (role.locked) {
      throw new ForbiddenException('Cannot modify locked system role');
    }

    role.permissions = dto.permissions;
    role.updated_on = new Date();

    await this.roleRepo.save(role);

    // Invalidate cached permissions for all users with this role
    await this.cacheService.invalidateRolePermissions(roleId);

    // Audit log
    await this.auditService.log({
      action: 'ROLE_PERMISSIONS_UPDATED',
      user_id: currentUser.id,
      role_id: roleId,
      changes: dto.permissions
    });

    return role;
  }

  // 3. Clone role with modifications
  @Post('roles/:roleId/clone')
  @RequirePermission('administration.manage_permissions')
  async cloneRole(
    @Param('roleId') roleId: number,
    @Body() dto: CloneRoleDto
  ): Promise<AppRole> {
    const sourceRole = await this.roleRepo.findOne(roleId);

    const newRole = this.roleRepo.create({
      name: dto.name,
      permissions: dto.modifyPermissions
        ? this.modifyPermissions(sourceRole.permissions, dto.modifications)
        : sourceRole.permissions,
      locked: false,
      active: true
    });

    return this.roleRepo.save(newRole);
  }

  // 4. Preview permission changes (before applying)
  @Post('roles/:roleId/permissions/preview')
  @RequirePermission('administration.manage_permissions')
  async previewPermissionChanges(
    @Param('roleId') roleId: number,
    @Body() dto: UpdatePermissionsDto
  ): Promise<PermissionDiff> {
    const role = await this.roleRepo.findOne(roleId);

    return {
      added: this.diffPermissions(dto.permissions, role.permissions),
      removed: this.diffPermissions(role.permissions, dto.permissions),
      modified: this.findModifiedPermissions(role.permissions, dto.permissions),
      affectedUsers: await this.countAffectedUsers(roleId)
    };
  }
}
```

---

### DTOs for Dynamic Permission Management

```typescript
// Permission schema definition
export interface PermissionSchema {
  resources: ResourceDefinition[];
}

export interface ResourceDefinition {
  name: string;           // e.g., 'sales'
  display: string;        // e.g., 'Sales & Customer Management'
  actions: ActionDefinition[];
  paths: string[];        // Available frontend paths
  sensitiveFields?: string[];
  dataScopes: ('all' | 'team' | 'self')[];
}

export interface ActionDefinition {
  name: string;           // e.g., 'read'
  display: string;        // e.g., 'View Sales'
  requiresApproval?: boolean;
}

// Update permissions DTO
export class UpdatePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];
}

export class PermissionDto {
  @IsString()
  resource: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  path?: string | string[];

  @IsOptional()
  @IsIn(['all', 'team', 'self'])
  data?: 'all' | 'team' | 'self';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyDto)
  policies: PolicyDto[];
}

export class PolicyDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  properties?: string[];
}

// Clone role DTO
export class CloneRoleDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsBoolean()
  @IsOptional()
  modifyPermissions?: boolean;

  @IsOptional()
  modifications?: {
    add?: PermissionDto[];
    remove?: string[];  // Resource names to remove
    modify?: PermissionDto[];
  };
}
```

---

## Permission Builder UI

### Frontend Component: Permission Builder

```typescript
// permission-builder.component.ts
@Component({
  selector: 'app-permission-builder',
  template: `
    <div class="permission-builder">
      <h3>Configure Permissions for: {{ role.name }}</h3>

      <!-- Resource Selection -->
      <div class="resource-list">
        <h4>Select Resources</h4>
        <div *ngFor="let resource of availableResources" class="resource-item">
          <mat-checkbox
            [(ngModel)]="resource.selected"
            (change)="onResourceToggle(resource)">
            {{ resource.display }}
          </mat-checkbox>

          <!-- Action Selection (shown when resource is selected) -->
          <div *ngIf="resource.selected" class="action-list">
            <h5>Actions</h5>
            <mat-chip-list>
              <mat-chip
                *ngFor="let action of resource.actions"
                [selected]="isActionSelected(resource, action)"
                (click)="toggleAction(resource, action)">
                {{ action.display }}
              </mat-chip>
            </mat-chip-list>

            <!-- Data Scope -->
            <mat-form-field>
              <mat-label>Data Scope</mat-label>
              <mat-select [(ngModel)]="resource.dataScope">
                <mat-option value="all">All Records</mat-option>
                <mat-option value="team">Team Records Only</mat-option>
                <mat-option value="self">Own Records Only</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Sensitive Fields -->
            <div *ngIf="resource.sensitiveFields?.length">
              <h5>Restrict Fields</h5>
              <mat-chip-list>
                <mat-chip
                  *ngFor="let field of resource.sensitiveFields"
                  [selected]="isFieldRestricted(resource, field)"
                  (click)="toggleFieldRestriction(resource, field)">
                  {{ field }}
                </mat-chip>
              </mat-chip-list>
            </div>
          </div>
        </div>
      </div>

      <!-- Permission Preview (JSON) -->
      <div class="permission-preview">
        <h4>Permission JSON Preview</h4>
        <pre>{{ buildPermissionJSON() | json }}</pre>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button mat-raised-button (click)="previewChanges()">
          Preview Impact
        </button>
        <button mat-raised-button color="primary" (click)="savePermissions()">
          Save Permissions
        </button>
        <button mat-button (click)="cancel()">Cancel</button>
      </div>
    </div>
  `
})
export class PermissionBuilderComponent implements OnInit {
  @Input() roleId: number;
  role: AppRole;
  availableResources: ResourceDefinition[];
  selectedPermissions: Map<string, Permission> = new Map();

  constructor(
    private permissionService: PermissionAdminService,
    private roleService: RoleService
  ) {}

  async ngOnInit() {
    // Load permission schema
    this.availableResources = await this.permissionService.getSchema();

    // Load current role permissions
    this.role = await this.roleService.findById(this.roleId);
    this.loadExistingPermissions();
  }

  loadExistingPermissions() {
    for (const perm of this.role.permissions) {
      this.selectedPermissions.set(perm.resource, perm);

      // Mark resource as selected
      const resource = this.availableResources.find(r => r.name === perm.resource);
      if (resource) {
        resource.selected = true;
        resource.dataScope = perm.data || 'all';
      }
    }
  }

  buildPermissionJSON(): Permission[] {
    return Array.from(this.selectedPermissions.values());
  }

  async savePermissions() {
    const permissions = this.buildPermissionJSON();

    await this.permissionService.updateRolePermissions(
      this.roleId,
      permissions
    );

    this.showSuccessMessage('Permissions updated successfully');
  }

  async previewChanges() {
    const permissions = this.buildPermissionJSON();

    const preview = await this.permissionService.previewChanges(
      this.roleId,
      permissions
    );

    this.showPreviewDialog(preview);
  }
}
```

---

## Multitenancy Implementation Strategy

### Step 1: Tenant Context Management

```typescript
// Tenant context interceptor
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Extract tenant from header or subdomain
    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    // Store in request for use by guards and services
    request.tenant = { id: tenantId };

    return next.handle();
  }

  private extractTenantId(request: any): number | null {
    // Option 1: From header
    const headerTenant = request.headers['x-tenant-id'];
    if (headerTenant) return parseInt(headerTenant);

    // Option 2: From subdomain (tenant.rgp-bo.com)
    const host = request.headers.host;
    const subdomain = host.split('.')[0];
    // Lookup tenant by subdomain code
    return this.lookupTenantByCode(subdomain);

    // Option 3: From JWT (already authenticated)
    return request.user?.tenant_id;
  }
}
```

---

### Step 2: Tenant Data Isolation

```typescript
// Tenant-scoped repository pattern
export class TenantScopedRepository<T> {
  constructor(
    private repository: Repository<T>,
    private tenantField: string = 'tenant_id'
  ) {}

  async find(options: FindOptions, tenantId: number): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: {
        ...options.where,
        [this.tenantField]: tenantId
      }
    });
  }

  async create(entity: Partial<T>, tenantId: number): Promise<T> {
    const newEntity = this.repository.create({
      ...entity,
      [this.tenantField]: tenantId
    });

    return this.repository.save(newEntity);
  }
}

// Usage in service
@Injectable()
export class SaleService {
  constructor(
    @InjectRepository(Sale)
    private saleRepo: Repository<Sale>
  ) {}

  async findAll(tenantId: number, userId: number): Promise<Sale[]> {
    const tenantRepo = new TenantScopedRepository(this.saleRepo);

    // Automatically filters by tenant_id
    return tenantRepo.find({}, tenantId);
  }
}
```

---

### Step 3: Tenant Switching

```typescript
// Tenant switch endpoint
@Controller('auth')
export class AuthController {

  @Post('switch-tenant')
  @UseGuards(AuthGuard)
  async switchTenant(
    @Body() dto: { tenant_id: number },
    @User() currentUser: any
  ): Promise<{ token: string }> {
    // Verify user has access to this tenant
    const userTenant = await this.userTenantRepo.findOne({
      where: {
        user_id: currentUser.id,
        tenant_id: dto.tenant_id,
        active: true
      }
    });

    if (!userTenant) {
      throw new ForbiddenException('No access to this tenant');
    }

    // Get tenant-specific roles and permissions
    const permissions = await this.permissionService.resolveUserPermissions(
      currentUser.id,
      dto.tenant_id
    );

    // Generate new JWT with new tenant context
    const token = this.authHelper.generateToken({
      ...currentUser,
      tenant_id: dto.tenant_id,
      permissions
    });

    return { token };
  }
}
```

---

## Migration Path: Current → Dynamic Multitenancy

### Phase 1: Multi-Role Support (Week 1)
**No tenant changes yet, just multi-role**

**Database:**
```sql
-- Add user_role_assignment table
-- Populate from existing app_user.role_id
-- Keep role_id for backward compatibility
```

**Backend:**
```typescript
// Update JWT to include all role_ids
// Implement permission merging logic
// Update permission resolution to use user_role_assignment
```

**Frontend:**
```typescript
// No changes needed (permissions array already supported)
```

**Testing:**
- Assign multiple roles to test users
- Verify permission merging works
- Test that most permissive wins

---

### Phase 2: Permission Management UI (Week 2)
**Dynamic permission configuration**

**Backend:**
```typescript
// Implement PermissionAdminController
// Add permission schema endpoint
// Add role permission update endpoints
// Add permission preview/diff logic
```

**Frontend:**
```typescript
// Create PermissionBuilderComponent
// Resource selection UI
// Action selection UI
// Data scope selector
// Field restriction toggles
// JSON preview
```

**Testing:**
- Admin can modify role permissions via UI
- Changes reflect immediately after token refresh
- Preview shows affected users

---

### Phase 3: Tenant Schema (Week 3)
**Add multitenancy tables**

**Database:**
```sql
-- Add tenant table
-- Add tenant_role table
-- Add user_tenant table
-- Add tenant_user_role table
-- Migrate existing data as single-tenant
```

**Backend:**
```typescript
// Implement TenantInterceptor
// Add tenant context to requests
// Update repositories for tenant scoping
```

**Testing:**
- Create test tenant
- Verify data isolation
- Test tenant-specific roles

---

### Phase 4: Tenant Switching (Week 4)
**Multi-tenant user experience**

**Backend:**
```typescript
// Implement tenant switching endpoint
// Update JWT to include tenant context
// Add tenant-scoped permission resolution
```

**Frontend:**
```typescript
// Add tenant selector in header
// Implement tenant switch functionality
// Store current tenant in state
// Refresh on tenant change
```

**Testing:**
- User can switch between tenants
- Permissions change based on tenant
- Data isolation maintained

---

## Permission Inheritance Examples

### Example 1: Global Role + Tenant Customization

**Global "Pharmacist" Role:**
```json
{
  "resource": "sales",
  "data": "all",
  "policies": [
    {"action": "read"},
    {"action": "create"}
  ]
}
```

**Tenant A Customization** (adds approval):
```json
{
  "base_role_id": 5,  // Pharmacist
  "permissions": [
    {
      "resource": "sales",
      "data": "all",
      "policies": [
        {"action": "read"},
        {"action": "create"},
        {"action": "approve"}  // Added by tenant
      ]
    }
  ]
}
```

**Result for Tenant A user:**
```json
{
  "resource": "sales",
  "data": "all",
  "policies": [
    {"action": "read"},
    {"action": "create"},
    {"action": "approve"}  // Merged
  ]
}
```

---

### Example 2: Multiple Roles with Conflicts

**User has:**
- "Store Manager" role (data: "all")
- "Part-Time Pharmacist" role (data: "self")

**Resolution:** Most permissive wins
```json
{
  "resource": "sales",
  "data": "all",  // Manager's "all" wins over Pharmacist's "self"
  "policies": [
    {"action": "read"},    // Both have
    {"action": "create"},  // Both have
    {"action": "approve"}, // From Manager
    {"action": "return"}   // From Pharmacist
  ]
}
```

---

## Performance Optimization

### Permission Caching Strategy

```typescript
@Injectable()
export class PermissionCacheService {
  constructor(
    @InjectRedis() private redis: Redis
  ) {}

  // Cache merged permissions per user per tenant
  async getUserPermissions(
    userId: number,
    tenantId: number
  ): Promise<Permission[]> {
    const cacheKey = `permissions:${tenantId}:${userId}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Compute permissions
    const permissions = await this.computePermissions(userId, tenantId);

    // Cache for 1 hour
    await this.redis.setex(cacheKey, 3600, JSON.stringify(permissions));

    return permissions;
  }

  // Invalidate when role permissions change
  async invalidateRole(roleId: number, tenantId?: number) {
    // Find all users with this role
    const users = await this.findUsersWithRole(roleId, tenantId);

    // Delete their permission caches
    for (const user of users) {
      const pattern = tenantId
        ? `permissions:${tenantId}:${user.id}`
        : `permissions:*:${user.id}`;

      await this.redis.del(pattern);
    }
  }

  // Invalidate when user roles change
  async invalidateUser(userId: number, tenantId?: number) {
    const pattern = tenantId
      ? `permissions:${tenantId}:${userId}`
      : `permissions:*:${userId}`;

    await this.redis.del(pattern);
  }
}
```

---

## Security Considerations

### 1. Permission Validation

```typescript
class PermissionValidator {
  validate(permissions: Permission[]): ValidationResult {
    const errors = [];

    for (const perm of permissions) {
      // Validate resource exists in schema
      if (!this.schema.hasResource(perm.resource)) {
        errors.push(`Unknown resource: ${perm.resource}`);
      }

      // Validate actions exist
      for (const policy of perm.policies) {
        if (!this.schema.hasAction(perm.resource, policy.action)) {
          errors.push(`Unknown action: ${perm.resource}.${policy.action}`);
        }
      }

      // Validate data scopes
      if (perm.data && !['all', 'team', 'self'].includes(perm.data)) {
        errors.push(`Invalid data scope: ${perm.data}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
```

### 2. Tenant Isolation Verification

```typescript
// Automated test to verify tenant isolation
describe('Tenant Isolation', () => {
  it('should not allow cross-tenant data access', async () => {
    const tenant1User = createUser({ tenant_id: 1 });
    const tenant2User = createUser({ tenant_id: 2 });

    const tenant1Sale = createSale({ tenant_id: 1 });

    // Attempt to access tenant 1 sale from tenant 2 user
    const result = await saleService.findById(
      tenant1Sale.id,
      tenant2User.id,
      2  // tenant_id
    );

    expect(result).toBeNull();  // Should not return
  });
});
```

---

## Admin UI Mockups

### Permission Builder Screen

```
┌─────────────────────────────────────────────────────────────┐
│ Configure Permissions: Store Manager                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Available Resources:                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☑ Sales & Customer Management                           │ │
│ │   Actions: [Read] [Create] [Edit] [Delete] [Approve]   │ │
│ │   Data Scope: ● All ○ Team ○ Self                       │ │
│ │   Restrict Fields: [cost] [margin]                      │ │
│ │                                                          │ │
│ │ ☑ Inventory & Stock Management                          │ │
│ │   Actions: [Read] [Create] [Edit] [Adjust Stock]       │ │
│ │   Data Scope: ● All ○ Team ○ Self                       │ │
│ │   Restrict Fields: (none)                               │ │
│ │                                                          │ │
│ │ ☐ Payroll Processing                                     │ │
│ │                                                          │ │
│ │ ☑ Human Resources                                        │ │
│ │   Actions: [Read] [Approve Leave]                       │ │
│ │   Data Scope: ○ All ● Team ○ Self                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Permission JSON Preview:                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [                                                        │ │
│ │   {                                                      │ │
│ │     "resource": "sales",                                 │ │
│ │     "data": "all",                                       │ │
│ │     "policies": [                                        │ │
│ │       {"action": "read"},                                │ │
│ │       {"action": "create"}                               │ │
│ │     ]                                                    │ │
│ │   }                                                      │ │
│ │ ]                                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Preview Impact] [Save Permissions] [Cancel]                │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

### ✅ What You Get

1. **Dynamic Permission Management**
   - Admin UI to configure role permissions
   - No code changes needed for permission updates
   - Visual builder with resource/action selection

2. **Multiple Roles per User**
   - Users can have multiple roles
   - Permissions automatically merged (union)
   - Most permissive wins

3. **Multitenancy Support**
   - Tenant-scoped roles and permissions
   - Global roles with tenant customization
   - Complete data isolation
   - Tenant switching

4. **Performance**
   - Permissions cached in Redis
   - Included in JWT (no DB lookup)
   - Invalidation on role changes

5. **Backward Compatible**
   - Existing JSON structure unchanged
   - app_user.role_id kept for compatibility
   - Gradual migration path

---

**Implementation Timeline:**
- Week 1: Multi-role support
- Week 2: Permission management UI
- Week 3: Multitenancy schema
- Week 4: Tenant switching

**Total: 4 weeks to full multitenancy**

---

**Status:** ✅ DESIGN COMPLETE
**Next Step:** Approve design and begin Phase 1
**Date:** 2026-01-11
