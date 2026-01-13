# Dynamic RBAC & Multitenancy - Quick Start Guide

**Date:** 2026-01-11
**Goal:** Get dynamic permission management working in 1 week

---

## Overview

Your current JSON permission system is **PERFECT** for dynamic configuration. You just need:
1. ✅ UI to modify the JSON
2. ✅ Multiple roles per user
3. ✅ (Later) Multitenancy support

---

## Week 1: Multiple Roles per User

### Day 1: Database Schema

**Create Migration:** `sql/migrations/035_multi_role_support.sql`

```sql
-- ============================================================================
-- Migration 035: Multi-Role Support (Backward Compatible)
-- Date: 2026-01-11
-- Description: Allow users to have multiple roles while keeping backward
--              compatibility with app_user.role_id
-- ============================================================================

BEGIN;

-- New table for multiple role assignments
CREATE TABLE IF NOT EXISTS user_role_assignment (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES app_user(id),
  assigned_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true,

  -- Metadata
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(user_id, role_id)
);

-- Indexes for performance
CREATE INDEX idx_user_role_user ON user_role_assignment(user_id) WHERE active = true;
CREATE INDEX idx_user_role_role ON user_role_assignment(role_id) WHERE active = true;

-- Migrate existing single-role assignments
INSERT INTO user_role_assignment (user_id, role_id, assigned_by, active)
SELECT
  id,
  role_id,
  1,  -- System user
  true
FROM app_user
WHERE role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Keep app_user.role_id for backward compatibility (primary role)
-- New code will use user_role_assignment for full list

-- Verification
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_role_assignment;

  RAISE NOTICE 'SUCCESS: % role assignments migrated', v_count;
END $$;

COMMIT;
```

**Create Rollback:** `sql/migrations/035_rollback.sql`

```sql
BEGIN;

-- Remove user_role_assignment table
DROP TABLE IF EXISTS user_role_assignment CASCADE;

COMMIT;
```

---

### Day 2: Backend - Permission Resolution

**Create Service:** `api-v2/src/core/services/permission.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppRole } from '../../entities/app-role.entity';
import { UserRoleAssignment } from '../../entities/user-role-assignment.entity';

export interface Permission {
  resource: string;
  path?: string | string[];
  data?: 'all' | 'team' | 'self';
  policies?: Policy[];
}

export interface Policy {
  action: string;
  path?: string;
  properties?: string[];
}

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(UserRoleAssignment)
    private userRoleRepo: Repository<UserRoleAssignment>,
    @InjectRepository(AppRole)
    private roleRepo: Repository<AppRole>
  ) {}

  /**
   * Resolve all permissions for a user (merge from all roles)
   */
  async resolveUserPermissions(userId: number): Promise<Permission[]> {
    // Get all active role assignments for user
    const assignments = await this.userRoleRepo.find({
      where: { user_id: userId, active: true },
      relations: ['role']
    });

    if (assignments.length === 0) {
      return [];
    }

    // Collect all permissions from all roles
    const allPermissions: Permission[] = [];

    for (const assignment of assignments) {
      const rolePermissions = assignment.role.permissions as Permission[];
      if (rolePermissions && Array.isArray(rolePermissions)) {
        allPermissions.push(...rolePermissions);
      }
    }

    // Merge permissions by resource
    return this.mergePermissions(allPermissions);
  }

  /**
   * Merge permissions (union - most permissive wins)
   */
  private mergePermissions(permissions: Permission[]): Permission[] {
    const merged = new Map<string, Permission>();

    for (const perm of permissions) {
      const key = perm.resource;

      if (!merged.has(key)) {
        // First time seeing this resource
        merged.set(key, { ...perm });
      } else {
        // Merge with existing
        const existing = merged.get(key)!;

        // Merge paths (union)
        existing.path = this.unionPaths(existing.path, perm.path);

        // Merge policies (union)
        existing.policies = this.mergePolicies(
          existing.policies || [],
          perm.policies || []
        );

        // Data scope: 'all' wins over 'team', 'team' wins over 'self'
        if (perm.data === 'all' || existing.data === 'all') {
          existing.data = 'all';
        } else if (perm.data === 'team' || existing.data === 'team') {
          existing.data = 'team';
        }
      }
    }

    return Array.from(merged.values());
  }

  private unionPaths(
    path1: string | string[] | undefined,
    path2: string | string[] | undefined
  ): string | string[] {
    const arr1 = Array.isArray(path1) ? path1 : path1 ? [path1] : [];
    const arr2 = Array.isArray(path2) ? path2 : path2 ? [path2] : [];

    const union = [...new Set([...arr1, ...arr2])];
    return union.length === 1 ? union[0] : union;
  }

  private mergePolicies(policies1: Policy[], policies2: Policy[]): Policy[] {
    const merged = new Map<string, Policy>();

    for (const policy of [...policies1, ...policies2]) {
      const key = policy.action;

      if (!merged.has(key)) {
        merged.set(key, { ...policy });
      } else {
        // Merge properties (union)
        const existing = merged.get(key)!;
        const existingProps = existing.properties || [];
        const newProps = policy.properties || [];
        const unionProps = [...new Set([...existingProps, ...newProps])];

        if (unionProps.length > 0) {
          existing.properties = unionProps;
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Check if user has specific permission
   */
  checkPermission(
    permissions: Permission[],
    resource: string,
    action: string
  ): boolean {
    const resourcePerm = permissions.find(p => p.resource === resource);

    if (!resourcePerm) {
      return false;
    }

    // If no policies, having the resource grants all actions
    if (!resourcePerm.policies || resourcePerm.policies.length === 0) {
      return true;
    }

    return resourcePerm.policies.some(p => p.action === action);
  }
}
```

**Create Entity:** `api-v2/src/entities/user-role-assignment.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { AppUser } from './app-user.entity';
import { AppRole } from './app-role.entity';

@Entity('user_role_assignment')
export class UserRoleAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'role_id' })
  role_id: number;

  @Column({ name: 'assigned_by', nullable: true })
  assigned_by: number;

  @Column({ name: 'assigned_on', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assigned_on: Date;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_on' })
  created_on: Date;

  @UpdateDateColumn({ name: 'updated_on' })
  updated_on: Date;

  // Relations
  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @ManyToOne(() => AppRole, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: AppRole;
}
```

---

### Day 3: Backend - Enhanced JWT

**Update:** `api-v2/src/modules/auth/auth.helper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppUser } from '../../entities/app-user.entity';
import { PermissionService, Permission } from '../../core/services/permission.service';

@Injectable()
export class AuthHelper {
  constructor(
    private readonly jwt: JwtService,
    private readonly permissionService: PermissionService
  ) {}

  public async generateToken(user: AppUser): Promise<string> {
    // Resolve all permissions for user (from all roles)
    const permissions = await this.permissionService.resolveUserPermissions(user.id);

    // Get all role IDs
    const roleIds = await this.getRoleIds(user.id);

    return this.jwt.sign({
      id: user.id,
      email: user.email,
      role_id: user.role_id,      // Primary role (backward compat)
      role_ids: roleIds,           // All roles
      permissions: permissions      // Merged permissions
    });
  }

  private async getRoleIds(userId: number): Promise<number[]> {
    // Query user_role_assignment
    const assignments = await this.userRoleAssignmentRepo.find({
      where: { user_id: userId, active: true }
    });

    return assignments.map(a => a.role_id);
  }
}
```

**Update:** `api-v2/src/modules/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthHelper } from './auth.helper';
import { AppUser } from '../../entities/app-user.entity';
import { UserRoleAssignment } from '../../entities/user-role-assignment.entity';
import { AppRole } from '../../entities/app-role.entity';
import { PermissionService } from '../../core/services/permission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppUser, UserRoleAssignment, AppRole]),
    JwtModule.register({
      secret: process.env.JWT_KEY || 'secretKey',
      signOptions: { expiresIn: '24h' }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthHelper, PermissionService],
  exports: [AuthHelper, PermissionService]
})
export class AuthModule {}
```

---

### Day 4: Backend - User Role Management API

**Create Controller:** `api-v2/src/modules/app/users/user-role.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { RbacGuard } from '../../../core/guards/rbac.guard';
import { RequirePermission } from '../../../core/decorator/require-permission.decorator';
import { User } from '../../../core/decorator/user.decorator';
import { UserRoleService } from './user-role.service';

class AssignRoleDto {
  userId: number;
  roleId: number;
}

@Controller('users/roles')
@ApiTags('User Roles')
@UseGuards(AuthGuard, RbacGuard)
@ApiBearerAuth()
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Get(':userId')
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'Get all roles for a user' })
  async getUserRoles(@Param('userId') userId: number) {
    return this.userRoleService.getUserRoles(userId);
  }

  @Post('assign')
  @RequirePermission('users.edit')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Body() dto: AssignRoleDto,
    @User() currentUser: any
  ) {
    return this.userRoleService.assignRole(
      dto.userId,
      dto.roleId,
      currentUser.id
    );
  }

  @Delete(':userId/:roleId')
  @RequirePermission('users.edit')
  @ApiOperation({ summary: 'Remove role from user' })
  async removeRole(
    @Param('userId') userId: number,
    @Param('roleId') roleId: number
  ) {
    return this.userRoleService.removeRole(userId, roleId);
  }

  @Post(':userId/refresh-permissions')
  @RequirePermission('users.edit')
  @ApiOperation({ summary: 'Refresh user permissions (generates new token)' })
  async refreshPermissions(@Param('userId') userId: number) {
    return this.userRoleService.refreshUserToken(userId);
  }
}
```

**Create Service:** `api-v2/src/modules/app/users/user-role.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleAssignment } from '../../../entities/user-role-assignment.entity';
import { AppUser } from '../../../entities/app-user.entity';
import { AppRole } from '../../../entities/app-role.entity';
import { AuthHelper } from '../../auth/auth.helper';

@Injectable()
export class UserRoleService {
  constructor(
    @InjectRepository(UserRoleAssignment)
    private userRoleRepo: Repository<UserRoleAssignment>,
    @InjectRepository(AppUser)
    private userRepo: Repository<AppUser>,
    @InjectRepository(AppRole)
    private roleRepo: Repository<AppRole>,
    private authHelper: AuthHelper
  ) {}

  async getUserRoles(userId: number) {
    const assignments = await this.userRoleRepo.find({
      where: { user_id: userId, active: true },
      relations: ['role']
    });

    return assignments.map(a => ({
      role_id: a.role_id,
      role_name: a.role.name,
      assigned_on: a.assigned_on,
      assigned_by: a.assigned_by
    }));
  }

  async assignRole(userId: number, roleId: number, assignedBy: number) {
    // Verify user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify role exists
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if already assigned
    const existing = await this.userRoleRepo.findOne({
      where: { user_id: userId, role_id: roleId }
    });

    if (existing) {
      existing.active = true;
      return this.userRoleRepo.save(existing);
    }

    // Create new assignment
    const assignment = this.userRoleRepo.create({
      user_id: userId,
      role_id: roleId,
      assigned_by: assignedBy,
      active: true
    });

    return this.userRoleRepo.save(assignment);
  }

  async removeRole(userId: number, roleId: number) {
    const assignment = await this.userRoleRepo.findOne({
      where: { user_id: userId, role_id: roleId }
    });

    if (!assignment) {
      throw new NotFoundException('Role assignment not found');
    }

    assignment.active = false;
    return this.userRoleRepo.save(assignment);
  }

  async refreshUserToken(userId: number): Promise<{ token: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = await this.authHelper.generateToken(user);

    return { token };
  }
}
```

---

### Day 5: Frontend - Multi-Role Assignment UI

**Update:** `frontend/src/app/secured/settings/users/user-form.component.ts`

```typescript
@Component({
  selector: 'app-user-form',
  template: `
    <form [formGroup]="userForm" (ngSubmit)="onSubmit()">
      <!-- Existing fields... -->

      <!-- Multi-Role Selection -->
      <div class="form-group">
        <label>Roles</label>
        <p-multiSelect
          [options]="availableRoles"
          [(ngModel)]="selectedRoles"
          optionLabel="name"
          optionValue="id"
          placeholder="Select roles"
          [showToggleAll]="false">

          <ng-template let-role pTemplate="item">
            <div class="role-item">
              <span>{{ role.name }}</span>
              <small *ngIf="role.id === user.role_id" class="badge badge-primary">
                Primary
              </small>
            </div>
          </ng-template>
        </p-multiSelect>

        <small class="form-text text-muted">
          Users can have multiple roles. Permissions will be merged.
        </small>
      </div>

      <button type="submit">Save</button>
    </form>
  `
})
export class UserFormComponent implements OnInit {
  userForm: FormGroup;
  availableRoles: AppRole[] = [];
  selectedRoles: number[] = [];
  user: AppUser;

  constructor(
    private userService: UserService,
    private roleService: RoleService
  ) {}

  async ngOnInit() {
    // Load available roles
    this.availableRoles = await this.roleService.findAll();

    // Load user's current roles
    if (this.user.id) {
      const userRoles = await this.userService.getUserRoles(this.user.id);
      this.selectedRoles = userRoles.map(r => r.role_id);
    } else {
      // New user - default to primary role
      this.selectedRoles = this.user.role_id ? [this.user.role_id] : [];
    }
  }

  async onSubmit() {
    // Save user basic info
    const savedUser = await this.userService.save(this.userForm.value);

    // Update role assignments
    await this.userService.updateUserRoles(savedUser.id, this.selectedRoles);

    this.showSuccess('User saved successfully');
  }
}
```

**Add to UserService:**

```typescript
async getUserRoles(userId: number): Promise<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/users/roles/${userId}`).toPromise();
}

async updateUserRoles(userId: number, roleIds: number[]): Promise<void> {
  // Get current roles
  const currentRoles = await this.getUserRoles(userId);
  const currentRoleIds = currentRoles.map(r => r.role_id);

  // Find roles to add
  const toAdd = roleIds.filter(id => !currentRoleIds.includes(id));

  // Find roles to remove
  const toRemove = currentRoleIds.filter(id => !roleIds.includes(id));

  // Add new roles
  for (const roleId of toAdd) {
    await this.http.post(`${this.apiUrl}/users/roles/assign`, {
      userId,
      roleId
    }).toPromise();
  }

  // Remove old roles
  for (const roleId of toRemove) {
    await this.http.delete(`${this.apiUrl}/users/roles/${userId}/${roleId}`).toPromise();
  }
}
```

---

## Testing Multi-Role Support

### Test Scenario 1: User with Multiple Roles

```typescript
// Create test user with two roles
const user = await userService.create({
  email: 'john@pharmacy.com',
  full_name: 'John Doe',
  role_id: 3  // Store Manager (primary)
});

// Assign additional role
await userRoleService.assignRole(user.id, 5, adminUserId);  // Pharmacist

// Login and verify permissions
const loginResult = await authService.login({
  email: 'john@pharmacy.com',
  password: 'password'
});

// Decode JWT - should have merged permissions
const decoded = jwt.decode(loginResult.token);

console.log(decoded.role_ids);      // [3, 5]
console.log(decoded.permissions);   // Merged from Manager + Pharmacist

// Verify frontend sees merged permissions
// Should have all actions from both roles
```

### Test Scenario 2: Permission Merging

```sql
-- Store Manager role
{
  "resource": "sales",
  "data": "all",
  "policies": [
    {"action": "read"},
    {"action": "approve"}
  ]
}

-- Pharmacist role
{
  "resource": "sales",
  "data": "team",
  "policies": [
    {"action": "read"},
    {"action": "create"}
  ]
}

-- Expected merged result
{
  "resource": "sales",
  "data": "all",  -- Manager's "all" wins
  "policies": [
    {"action": "read"},    -- Both have
    {"action": "create"},  -- From Pharmacist
    {"action": "approve"}  -- From Manager
  ]
}
```

---

## What You've Achieved

After Week 1, you have:

✅ **Multiple Roles per User**
- Users can have 2, 3, or more roles
- Backward compatible (app_user.role_id still works)
- Permissions automatically merged

✅ **Enhanced JWT**
- Includes all role IDs
- Includes merged permissions (no DB lookup needed)
- Performance optimized

✅ **User Management UI**
- Multi-select role assignment
- Visual indication of primary role
- Easy to add/remove roles

✅ **Permission Resolution**
- Union of all role permissions
- Most permissive wins
- Reusable service

---

## Next: Week 2 - Permission Management UI

(See DYNAMIC_RBAC_MULTITENANCY_DESIGN.md for full details)

**Quick Preview:**
- Visual permission builder
- Drag-and-drop resource/action selection
- JSON preview
- Permission validation
- Impact preview (affected users)

---

**Status:** ✅ WEEK 1 GUIDE COMPLETE
**Next:** Build this, then tackle permission management UI
**Date:** 2026-01-11
