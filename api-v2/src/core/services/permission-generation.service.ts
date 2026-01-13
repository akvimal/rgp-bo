import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleFeatureAssignment } from '../../entities/role-feature-assignment.entity';
import { Permission } from '../../entities/access-level.entity';

@Injectable()
export class PermissionGenerationService {
  private readonly logger = new Logger(PermissionGenerationService.name);

  constructor(
    @InjectRepository(RoleFeatureAssignment)
    private roleFeatureRepo: Repository<RoleFeatureAssignment>,
  ) {}

  /**
   * Generate complete permissions array for a role from its feature group assignments
   * @param roleId - The role ID to generate permissions for
   * @returns Array of permission objects
   */
  async generateRolePermissions(roleId: number): Promise<Permission[]> {
    this.logger.log(`Generating permissions for role ID: ${roleId}`);

    // Get all active feature assignments for the role
    const assignments = await this.roleFeatureRepo.find({
      where: { roleId, active: true },
      relations: ['accessLevel', 'featureGroup', 'subFeatureAssignments', 'subFeatureAssignments.accessLevel'],
    });

    if (assignments.length === 0) {
      this.logger.warn(`No feature assignments found for role ID: ${roleId}`);
      return [];
    }

    const allPermissions: Permission[] = [];

    // Process each feature group assignment
    for (const assignment of assignments) {
      // Get main feature permissions from access level
      if (assignment.accessLevel && assignment.accessLevel.permissions) {
        const featurePermissions = this.applyDataScope(
          assignment.accessLevel.permissions as Permission[],
          assignment.dataScope,
        );
        allPermissions.push(...featurePermissions);
      }

      // Get sub-feature permissions
      if (assignment.subFeatureAssignments && assignment.subFeatureAssignments.length > 0) {
        for (const subAssignment of assignment.subFeatureAssignments) {
          if (subAssignment.active && subAssignment.accessLevel && subAssignment.accessLevel.permissions) {
            const subPermissions = this.applyDataScope(
              subAssignment.accessLevel.permissions as Permission[],
              assignment.dataScope, // Use parent data scope
            );
            allPermissions.push(...subPermissions);
          }
        }
      }

      // Apply feature-specific options
      if (assignment.options) {
        this.applyOptions(allPermissions, assignment.options, assignment.featureGroup?.name);
      }
    }

    // Merge and deduplicate permissions
    const mergedPermissions = this.mergePermissions(allPermissions);

    this.logger.log(`Generated ${mergedPermissions.length} unique permissions for role ID: ${roleId}`);
    return mergedPermissions;
  }

  /**
   * Apply data scope to permissions
   * @param permissions - Original permissions
   * @param dataScope - Data scope to apply ('all', 'team', 'own')
   * @returns Permissions with applied data scope
   */
  private applyDataScope(permissions: Permission[], dataScope: string): Permission[] {
    return permissions.map(perm => ({
      ...perm,
      dataScope: dataScope || perm.dataScope || 'all',
    }));
  }

  /**
   * Apply feature-specific options to permissions
   * @param permissions - Permissions array to modify
   * @param options - Options object with feature-specific toggles
   * @param featureName - Name of the feature group
   */
  private applyOptions(permissions: Permission[], options: Record<string, any>, featureName?: string): void {
    // Example: For inventory, if viewCost: false, remove cost-related fields
    if (featureName === 'inventory_management' && options.viewCost === false) {
      permissions.forEach(perm => {
        if (perm.resource === 'stock' && perm.fields) {
          perm.fields = perm.fields.filter(field =>
            !['cost', 'unitPrice', 'totalCost'].includes(field)
          );
        }
      });
    }

    // Example: For sales, if allowVoid: true, add void permission
    if (featureName === 'sales_management' && options.allowVoid === true) {
      const voidPermission = permissions.find(
        p => p.resource === 'sales' && p.action === 'delete'
      );
      if (!voidPermission) {
        permissions.push({
          resource: 'sales',
          action: 'delete',
          dataScope: 'all',
        });
      }
    }

    // Example: For sales, if allowDiscounts: false, remove discount fields
    if (featureName === 'sales_management' && options.allowDiscounts === false) {
      permissions.forEach(perm => {
        if (perm.resource === 'sales' && perm.fields) {
          perm.fields = perm.fields.filter(field =>
            !['discount', 'discountPercent', 'discountAmount'].includes(field)
          );
        }
      });
    }
  }

  /**
   * Merge permissions and remove duplicates
   * Uses the most permissive data scope when duplicates are found
   * @param permissions - Array of permissions to merge
   * @returns Merged permissions array
   */
  private mergePermissions(permissions: Permission[]): Permission[] {
    const permissionMap = new Map<string, Permission>();

    // Data scope hierarchy (higher is more permissive)
    const scopeRank = { all: 3, team: 2, own: 1 };

    for (const perm of permissions) {
      const key = `${perm.resource}:${perm.action}`;
      const existing = permissionMap.get(key);

      if (!existing) {
        permissionMap.set(key, { ...perm });
      } else {
        // Keep the most permissive data scope
        const existingRank = scopeRank[existing.dataScope as keyof typeof scopeRank] || 0;
        const newRank = scopeRank[perm.dataScope as keyof typeof scopeRank] || 0;

        if (newRank > existingRank) {
          existing.dataScope = perm.dataScope;
        }

        // Merge fields arrays
        if (perm.fields && existing.fields) {
          existing.fields = Array.from(new Set([...existing.fields, ...perm.fields]));
        } else if (perm.fields && !existing.fields) {
          existing.fields = [...perm.fields];
        }
      }
    }

    return Array.from(permissionMap.values());
  }

  /**
   * Check if a role uses feature groups or legacy permissions
   * @param roleId - The role ID to check
   * @returns True if role uses feature groups
   */
  async usesFeatureGroups(roleId: number): Promise<boolean> {
    const count = await this.roleFeatureRepo.count({
      where: { roleId, active: true },
    });
    return count > 0;
  }

  /**
   * Preview permissions for a feature group assignment without saving
   * Useful for UI to show what permissions will be granted
   * @param accessLevelId - Access level ID
   * @param dataScope - Data scope to apply
   * @param options - Feature options
   * @returns Preview of permissions
   */
  async previewPermissions(
    accessLevelId: number,
    dataScope: string = 'all',
    options: Record<string, any> = {},
  ): Promise<Permission[]> {
    // This would need to fetch the access level and apply transformations
    // Implementation depends on how you want to structure the preview endpoint
    // For now, returning empty array as placeholder
    this.logger.log(`Preview requested for access level ${accessLevelId}`);
    return [];
  }
}
