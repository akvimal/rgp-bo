import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PermissionService } from './permission.service';
import { AppUser } from '../../entities/appuser.entity';

/**
 * DataScopeService
 *
 * Enforces data scope filtering on database queries based on user permissions.
 * Supports three data scope levels:
 * - 'all': User can access all records
 * - 'team': User can access only records from their team/store
 * - 'own': User can access only their own records
 *
 * Usage:
 * 1. Inject DataScopeService into your service
 * 2. Call applyDataScopeFilter() on your query builder
 * 3. Call canAccessRecord() to check individual record access
 */
@Injectable()
export class DataScopeService {
  private readonly logger = new Logger(DataScopeService.name);

  constructor(
    private permissionService: PermissionService,
    @InjectRepository(AppUser)
    private userRepo: Repository<AppUser>,
  ) {}

  /**
   * Apply data scope filtering to a TypeORM query builder
   *
   * @param query - TypeORM SelectQueryBuilder
   * @param userId - Current user ID
   * @param resource - Resource name (e.g., 'sales', 'purchases')
   * @param options - Configuration options
   * @returns Modified query builder with data scope filter applied
   *
   * @example
   * let query = this.saleRepo.createQueryBuilder('sale');
   * query = await this.dataScopeService.applyDataScopeFilter(
   *   query,
   *   user.id,
   *   'sales',
   *   { alias: 'sale', userIdField: 'created_by', storeIdField: 'store_id' }
   * );
   */
  async applyDataScopeFilter<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    userId: number,
    resource: string,
    options: {
      alias?: string;
      userIdField?: string;
      storeIdField?: string;
      teamIdField?: string;
    } = {}
  ): Promise<SelectQueryBuilder<T>> {
    const {
      alias = query.alias,
      userIdField = 'created_by',
      storeIdField = 'store_id',
      teamIdField = 'store_id', // Default to store_id for team filtering
    } = options;

    // Get user's permissions and data scope for this resource
    const permissions = await this.permissionService.resolveUserPermissions(userId);
    const dataScope = this.permissionService.getDataScope(permissions, resource);

    this.logger.debug(
      `Applying data scope filter: userId=${userId}, resource=${resource}, scope=${dataScope}`
    );

    // No permission for this resource - return empty result set
    if (!dataScope) {
      this.logger.warn(`No data scope found for user ${userId} on resource ${resource}`);
      query.andWhere('1 = 0'); // Always false condition
      return query;
    }

    // Apply filtering based on data scope
    // Note: Using 'self' as that's the type name, but it means 'own data'
    if (dataScope === 'self') {
      // Filter: Only records created by this user
      this.logger.debug(`Applying 'self' (own) filter: ${alias}.${userIdField} = ${userId}`);
      query.andWhere(`${alias}.${userIdField} = :currentUserId`, { currentUserId: userId });
    }
    else if (dataScope === 'team') {
      // NOTE: 'team' scope requires AppUser to have a store_id field
      // Currently AppUser doesn't have this field, so we fall back to 'own' scope
      // TODO: Add store_id to AppUser entity and update this logic
      this.logger.warn(`'team' scope requested but AppUser.store_id not implemented. Falling back to 'own' scope for user ${userId}`);
      query.andWhere(`${alias}.${userIdField} = :currentUserId`, { currentUserId: userId });

      // Future implementation (when AppUser has store_id):
      // const user = await this.getUserWithStore(userId);
      // if (user && user.storeid) {
      //   this.logger.debug(`Applying 'team' filter: ${alias}.${teamIdField} = ${user.storeid}`);
      //   query.andWhere(`${alias}.${teamIdField} = :userStoreId`, { userStoreId: user.storeid });
      // } else {
      //   // User has no store assigned - treat as 'own' scope
      //   this.logger.warn(`User ${userId} has no store_id, falling back to 'own' scope`);
      //   query.andWhere(`${alias}.${userIdField} = :currentUserId`, { currentUserId: userId });
      // }
    }
    // 'all' scope: no filter applied, user can see everything

    return query;
  }

  /**
   * Check if a user can access a specific record based on data scope
   *
   * @param userId - Current user ID
   * @param resource - Resource name
   * @param record - The record to check (must have owner/store info)
   * @returns true if user can access the record
   * @throws ForbiddenException if access is denied
   *
   * @example
   * const sale = await this.saleRepo.findOne({ where: { id } });
   * await this.dataScopeService.checkRecordAccess(
   *   user.id,
   *   'sales',
   *   { createdBy: sale.createdBy, storeId: sale.storeId }
   * );
   */
  async checkRecordAccess(
    userId: number,
    resource: string,
    record: {
      createdBy?: number;
      storeId?: number;
      ownerId?: number;
    },
    throwError: boolean = true
  ): Promise<boolean> {
    const permissions = await this.permissionService.resolveUserPermissions(userId);
    const dataScope = this.permissionService.getDataScope(permissions, resource);

    // No permission for this resource
    if (!dataScope) {
      this.logger.warn(`No data scope found for user ${userId} on resource ${resource}`);
      if (throwError) {
        throw new ForbiddenException(`You do not have permission to access ${resource}`);
      }
      return false;
    }

    // 'all' scope: can access everything
    if (dataScope === 'all') {
      return true;
    }

    // 'self' scope: can only access own records
    if (dataScope === 'self') {
      const recordOwnerId = record.ownerId || record.createdBy;

      if (!recordOwnerId) {
        this.logger.warn(`Record has no owner information for 'self' scope check`);
        if (throwError) {
          throw new ForbiddenException('Cannot verify record ownership');
        }
        return false;
      }

      const hasAccess = recordOwnerId === userId;

      if (!hasAccess && throwError) {
        throw new ForbiddenException(`You can only access your own ${resource}`);
      }

      return hasAccess;
    }

    // 'team' scope: can access records from same team/store
    if (dataScope === 'team') {
      // NOTE: 'team' scope requires AppUser to have a store_id field
      // Currently not implemented, so we fall back to 'own' check
      this.logger.warn(`'team' scope requested but AppUser.store_id not implemented. Falling back to 'own' scope check for user ${userId}`);
      const recordOwnerId = record.ownerId || record.createdBy;
      const hasAccess = recordOwnerId === userId;

      if (!hasAccess && throwError) {
        throw new ForbiddenException(`You can only access your own ${resource}`);
      }

      return hasAccess;

      // Future implementation (when AppUser has store_id):
      // const user = await this.getUserWithStore(userId);
      // if (!user || !user.storeid) {
      //   // Fallback to 'own' check
      //   const recordOwnerId = record.ownerId || record.createdBy;
      //   const hasAccess = recordOwnerId === userId;
      //   if (!hasAccess && throwError) {
      //     throw new ForbiddenException(`You can only access your own ${resource}`);
      //   }
      //   return hasAccess;
      // }
      // if (!record.storeId) {
      //   if (throwError) {
      //     throw new ForbiddenException('Cannot verify team/store access');
      //   }
      //   return false;
      // }
      // const hasAccess = user.storeid === record.storeId;
      // if (!hasAccess && throwError) {
      //   throw new ForbiddenException(`You can only access ${resource} from your team/store`);
      // }
      // return hasAccess;
    }

    return false;
  }

  /**
   * Get data scope for a user and resource (without throwing errors)
   *
   * @param userId - User ID
   * @param resource - Resource name
   * @returns Data scope string or null
   */
  async getDataScope(
    userId: number,
    resource: string
  ): Promise<'all' | 'team' | 'own' | 'self' | null> {
    const permissions = await this.permissionService.resolveUserPermissions(userId);
    return this.permissionService.getDataScope(permissions, resource) as any;
  }

  /**
   * Check if user has specific permission for a resource
   *
   * @param userId - User ID
   * @param resource - Resource name
   * @param action - Action name (e.g., 'create', 'edit', 'delete')
   * @returns true if user has permission
   */
  async hasPermission(
    userId: number,
    resource: string,
    action: string
  ): Promise<boolean> {
    const permissions = await this.permissionService.resolveUserPermissions(userId);
    return this.permissionService.checkPermission(permissions, resource, action);
  }

  /**
   * Get user with store information (cached for performance)
   *
   * NOTE: Currently commented out because AppUser doesn't have store_id field
   * Uncomment and update when store_id is added to AppUser entity
   *
   * @param userId - User ID
   * @returns User with store_id
   */
  private async getUserWithStore(userId: number): Promise<AppUser | null> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['id'], // TODO: Add 'storeid' when field exists
      });
      return user;
    } catch (error) {
      this.logger.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Apply data scope filter with explicit scope (for testing or override scenarios)
   *
   * @param query - Query builder
   * @param dataScope - Explicit data scope to apply
   * @param userId - User ID
   * @param options - Filter options
   */
  applyExplicitDataScope<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    dataScope: 'all' | 'team' | 'own' | 'self',
    userId: number,
    userStoreId: number | null,
    options: {
      alias?: string;
      userIdField?: string;
      storeIdField?: string;
    } = {}
  ): SelectQueryBuilder<T> {
    const {
      alias = query.alias,
      userIdField = 'created_by',
      storeIdField = 'store_id',
    } = options;

    if (dataScope === 'own' || dataScope === 'self') {
      query.andWhere(`${alias}.${userIdField} = :currentUserId`, { currentUserId: userId });
    } else if (dataScope === 'team' && userStoreId) {
      query.andWhere(`${alias}.${storeIdField} = :userStoreId`, { userStoreId });
    }
    // 'all': no filter

    return query;
  }
}
