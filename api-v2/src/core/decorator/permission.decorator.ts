import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

/**
 * Marks a route as requiring a specific permission check.
 * Works with PermissionGuard.
 *
 * Usage with named permission methods:
 *   @Permission('viewCost') → PermissionService.assertCanViewCost()
 *   @Permission('managePricing') → PermissionService.assertCanManagePricing()
 *   @Permission('auditStock') → PermissionService.assertCanAuditStock()
 *   @Permission('manageBusinesses') → PermissionService.assertCanManageBusinesses()
 *   @Permission('manageDeliveryPartners') → PermissionService.canManageDeliveryPartners() (the owner roles, or a role with deliverypartners manage)
 *   @Permission('useReports') → PermissionService.canUseReports() (the owner roles, or a role given the Reports page)
 *
 * Usage with generic resource:action checks:
 *   @Permission('purchaseorders:approve') → PermissionService.can(roleid, 'purchaseorders', 'approve')
 */
export const Permission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
