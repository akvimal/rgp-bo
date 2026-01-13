import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppRole } from '../../entities/approle.entity';
import { UserRoleAssignment } from '../../entities/user-role-assignment.entity';
import { PermissionGenerationService } from './permission-generation.service';

/**
 * Permission structure (matches frontend JSON format)
 */
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

/**
 * PermissionService
 *
 * Handles multi-role permission resolution and merging.
 *
 * Key Features:
 * - Merges permissions from multiple roles per user
 * - Union strategy: most permissive wins
 * - Data scope: 'all' > 'team' > 'self'
 * - Actions: union of all actions from all roles
 */
@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(UserRoleAssignment)
    private userRoleRepo: Repository<UserRoleAssignment>,
    @InjectRepository(AppRole)
    private roleRepo: Repository<AppRole>,
    @Inject(forwardRef(() => PermissionGenerationService))
    private permissionGenService: PermissionGenerationService
  ) {}

  /**
   * Resolve all permissions for a user (merge from all active roles)
   *
   * Supports both legacy permission JSON and feature group-based permissions.
   * If a role uses feature groups, permissions are generated from feature assignments.
   * Otherwise, legacy permissions JSON is used.
   *
   * @param userId - User ID to resolve permissions for
   * @returns Merged permission array
   *
   * @example
   * // User has roles: [Store Manager, Pharmacist]
   * // Returns merged permissions with union of all actions
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
      const role = assignment.role;

      // Check if role uses feature groups
      if (role.usesFeatureGroups) {
        // Generate permissions from feature group assignments
        const featurePermissions = await this.permissionGenService.generateRolePermissions(role.id);
        // Convert to legacy format for merging
        const legacyFormatPermissions = this.convertToLegacyFormat(featurePermissions);
        allPermissions.push(...legacyFormatPermissions);
      } else {
        // Use legacy permissions JSON
        const rolePermissions = role.permissions as any;
        if (rolePermissions && Array.isArray(rolePermissions)) {
          allPermissions.push(...rolePermissions);
        }
      }
    }

    // Merge permissions by resource
    return this.mergePermissions(allPermissions);
  }

  /**
   * Convert feature group permissions to legacy format
   *
   * Feature group format: {resource, action, dataScope, fields}
   * Legacy format: {resource, path, data, policies: [{action, properties}]}
   */
  private convertToLegacyFormat(featurePermissions: any[]): Permission[] {
    const grouped = new Map<string, Permission>();

    for (const perm of featurePermissions) {
      const resource = perm.resource;

      if (!grouped.has(resource)) {
        grouped.set(resource, {
          resource: resource,
          data: perm.dataScope || 'all',
          policies: []
        });
      }

      const existing = grouped.get(resource)!;

      // Add action to policies
      if (perm.action) {
        const policy: Policy = {
          action: perm.action,
          properties: perm.fields || []
        };
        existing.policies!.push(policy);
      }

      // Update data scope to most permissive
      existing.data = this.mergeDataScope(existing.data, perm.dataScope);
    }

    return Array.from(grouped.values());
  }

  /**
   * Merge permissions using union strategy (most permissive wins)
   *
   * Rules:
   * 1. Same resource: merge paths, policies, and data scope
   * 2. Data scope: 'all' > 'team' > 'self'
   * 3. Policies: union of all actions
   * 4. Properties: union of all properties
   *
   * @param permissions - Array of permissions to merge
   * @returns Merged permissions grouped by resource
   */
  private mergePermissions(permissions: Permission[]): Permission[] {
    const merged = new Map<string, Permission>();

    for (const perm of permissions) {
      const key = perm.resource;

      if (!merged.has(key)) {
        // First time seeing this resource - add as-is
        merged.set(key, {
          resource: perm.resource,
          path: perm.path,
          data: perm.data,
          policies: perm.policies ? [...perm.policies] : []
        });
      } else {
        // Merge with existing permission
        const existing = merged.get(key)!;

        // Merge paths (union)
        existing.path = this.unionPaths(existing.path, perm.path);

        // Merge policies (union of actions)
        if (perm.policies && perm.policies.length > 0) {
          existing.policies = this.mergePolicies(
            existing.policies || [],
            perm.policies
          );
        }

        // Data scope: most permissive wins
        existing.data = this.mergeDataScope(existing.data, perm.data);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Union two path values
   * Handles both string and array formats
   */
  private unionPaths(
    path1: string | string[] | undefined,
    path2: string | string[] | undefined
  ): string | string[] | undefined {
    if (!path1 && !path2) return undefined;
    if (!path1) return path2;
    if (!path2) return path1;

    const arr1 = Array.isArray(path1) ? path1 : [path1];
    const arr2 = Array.isArray(path2) ? path2 : [path2];

    const union = [...new Set([...arr1, ...arr2])];

    // Return single string if only one path, array otherwise
    return union.length === 1 ? union[0] : union;
  }

  /**
   * Merge policies from two sources
   * Creates union of actions, merging properties for same action
   */
  private mergePolicies(policies1: Policy[], policies2: Policy[]): Policy[] {
    const merged = new Map<string, Policy>();

    // Process both arrays
    for (const policy of [...policies1, ...policies2]) {
      const key = policy.action;

      if (!merged.has(key)) {
        // First time seeing this action
        merged.set(key, {
          action: policy.action,
          path: policy.path,
          properties: policy.properties ? [...policy.properties] : []
        });
      } else {
        // Merge properties (union)
        const existing = merged.get(key)!;

        if (policy.properties && policy.properties.length > 0) {
          const existingProps = existing.properties || [];
          const unionProps = [...new Set([...existingProps, ...policy.properties])];
          existing.properties = unionProps;
        }

        // If different paths, keep both (convert to array)
        if (policy.path && policy.path !== existing.path) {
          const paths = [existing.path, policy.path].filter(Boolean);
          existing.path = paths.length > 1 ? paths.join(',') : paths[0];
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Merge data scopes - most permissive wins
   * Precedence: 'all' > 'team' > 'self' > undefined
   */
  private mergeDataScope(
    scope1: 'all' | 'team' | 'self' | undefined,
    scope2: 'all' | 'team' | 'self' | undefined
  ): 'all' | 'team' | 'self' | undefined {
    if (scope1 === 'all' || scope2 === 'all') return 'all';
    if (scope1 === 'team' || scope2 === 'team') return 'team';
    if (scope1 === 'self' || scope2 === 'self') return 'self';
    return undefined;
  }

  /**
   * Check if user has specific permission
   *
   * @param permissions - User's merged permissions
   * @param resource - Resource name (e.g., 'sales')
   * @param action - Action name (e.g., 'create')
   * @returns true if user has permission
   *
   * @example
   * const hasPermission = this.checkPermission(
   *   userPermissions,
   *   'sales',
   *   'create'
   * );
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

    // If no policies defined, having the resource grants all actions
    if (!resourcePerm.policies || resourcePerm.policies.length === 0) {
      return true;
    }

    // Check if action exists in policies
    return resourcePerm.policies.some(p => p.action === action);
  }

  /**
   * Get data scope for a resource
   *
   * @param permissions - User's merged permissions
   * @param resource - Resource name
   * @returns Data scope ('all', 'team', 'self', or undefined)
   */
  getDataScope(
    permissions: Permission[],
    resource: string
  ): 'all' | 'team' | 'self' | undefined {
    const resourcePerm = permissions.find(p => p.resource === resource);
    return resourcePerm?.data;
  }

  /**
   * Get all role IDs for a user
   *
   * @param userId - User ID
   * @returns Array of role IDs
   */
  async getUserRoleIds(userId: number): Promise<number[]> {
    const assignments = await this.userRoleRepo.find({
      where: { user_id: userId, active: true },
      select: ['role_id']
    });

    return assignments.map(a => a.role_id);
  }
}
