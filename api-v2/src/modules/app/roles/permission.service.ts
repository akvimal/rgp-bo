import { ForbiddenException, Injectable } from "@nestjs/common";
import { RoleService } from "./role.service";

type RolePermission = {
  resource?: string;
  path?: string | string[];
  policies?: Array<{
    action?: string;
    path?: string;
    properties?: string[];
  }>;
};

@Injectable()
export class PermissionService {
  private readonly privilegedRoles = new Set(['Business Head', 'Store Head']);

  constructor(private readonly roleService: RoleService) {}

  async getRole(roleid: number | string) {
    return this.findRole(roleid);
  }

  private async findRole(roleid: number | string) {
    if (roleid === null || roleid === undefined || roleid === '') {
      return null;
    }
    return this.roleService.findById(Number(roleid));
  }

  private normalizePermissions(role: any): RolePermission[] {
    if (!role?.permissions) {
      return [];
    }

    if (Array.isArray(role.permissions)) {
      return role.permissions as RolePermission[];
    }

    if (typeof role.permissions === 'string') {
      try {
        const parsed = JSON.parse(role.permissions);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  private hasPermission(role: any, resource: string, action: string, requiredProperties: string[] = []): boolean {
    const permissions = this.normalizePermissions(role);
    return permissions.some((perm) => {
      if (perm.resource !== resource) {
        return false;
      }
      return (perm.policies || []).some((policy) => {
        if (policy.action !== action) {
          return false;
        }
        if (!requiredProperties.length) {
          return true;
        }
        const props = policy.properties || [];
        return requiredProperties.every((prop) => props.includes(prop));
      });
    });
  }

  async can(roleid: number | string, resource: string, action: string, requiredProperties: string[] = []): Promise<boolean> {
    const role = await this.findRole(roleid);
    if (!role) {
      return false;
    }

    return this.hasPermission(role, resource, action, requiredProperties);
  }

  async canViewCost(roleid: number | string): Promise<boolean> {
    const role = await this.findRole(roleid);
    if (!role) {
      return false;
    }

    if (this.privilegedRoles.has(role.name)) {
      return true;
    }

    return (
      this.hasPermission(role, 'products', 'price') ||
      this.hasPermission(role, 'store', 'read', ['ptrcost'])
    );
  }

  async canManagePricing(roleid: number | string): Promise<boolean> {
    const role = await this.findRole(roleid);
    if (!role) {
      return false;
    }

    return this.privilegedRoles.has(role.name) || this.hasPermission(role, 'products', 'price');
  }

  async canManageBusinesses(roleid: number | string): Promise<boolean> {
    const role = await this.findRole(roleid);
    if (!role) {
      return false;
    }

    if (role.name === 'Site Admin') {
      return true;
    }

    return this.hasPermission(role, 'businesses', 'manage');
  }

  async canAuditStock(roleid: number | string): Promise<boolean> {
    const role = await this.findRole(roleid);
    if (!role) {
      return false;
    }

    return (
      this.privilegedRoles.has(role.name) ||
      this.hasPermission(role, 'stock', 'adjust') ||
      this.hasPermission(role, 'stock', 'audit') ||
      this.hasPermission(role, 'store', 'adjust')
    );
  }

  async assertCanViewCost(roleid: number | string): Promise<void> {
    if (!(await this.canViewCost(roleid))) {
      throw new ForbiddenException('Cost access denied');
    }
  }

  async assertCanManagePricing(roleid: number | string): Promise<void> {
    if (!(await this.canManagePricing(roleid))) {
      throw new ForbiddenException('Pricing access denied');
    }
  }

  async assertCanManageBusinesses(roleid: number | string): Promise<void> {
    if (!(await this.canManageBusinesses(roleid))) {
      throw new ForbiddenException('Business admin access denied');
    }
  }

  async assertCanAuditStock(roleid: number | string): Promise<void> {
    if (!(await this.canAuditStock(roleid))) {
      throw new ForbiddenException('Stock audit access denied');
    }
  }
}
