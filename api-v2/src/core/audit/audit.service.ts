import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

export interface AuditLogData {
  userId: number;
  action: string;
  resourceType: string;
  resourceId?: number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Log a user management action (create, update, delete)
   */
  async logUserAction(data: {
    userId: number | null;   // Who performed action (null for system actions)
    action: string;          // USER_CREATE, USER_UPDATE, USER_DELETE
    targetUserId: number;    // Which user was affected
    oldValues?: any;         // Before state
    newValues?: any;         // After state
    ipAddress?: string;
  }): Promise<void> {
    console.log('[AuditService] logUserAction called with:', JSON.stringify(data, null, 2));
    try {
      const auditEntry = {
        userid: data.userId,
        action: data.action,
        resourcetype: 'user',
        resourceid: data.targetUserId,
        oldvalues: data.oldValues,
        newvalues: data.newValues,
        ipaddress: data.ipAddress,
      };
      console.log('[AuditService] Saving audit entry:', JSON.stringify(auditEntry, null, 2));
      const result = await this.auditLogRepository.save(auditEntry);
      console.log('[AuditService] Audit entry saved with ID:', result.id);
      this.logger.log(`Logged user action: ${data.action} by user ${data.userId} on user ${data.targetUserId}`);
    } catch (error) {
      console.error('[AuditService] ERROR saving audit log:', error);
      this.logger.error(`Failed to log user action: ${error.message}`, error.stack);
      throw error; // Re-throw so we can see it in UserService
    }
  }

  /**
   * Log a role management action (create, update, delete)
   */
  async logRoleAction(data: {
    userId: number | null;   // Who performed action (null for system actions)
    action: string;          // ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE
    roleId: number;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.auditLogRepository.save({
        userid: data.userId,
        action: data.action,
        resourcetype: 'role',
        resourceid: data.roleId,
        oldvalues: data.oldValues,
        newvalues: data.newValues,
        ipaddress: data.ipAddress,
      });
      this.logger.log(`Logged role action: ${data.action} by user ${data.userId} on role ${data.roleId}`);
    } catch (error) {
      this.logger.error(`Failed to log role action: ${error.message}`, error.stack);
    }
  }

  /**
   * Log a role assignment or removal
   */
  async logRoleAssignment(data: {
    userId: number;          // Who performed the action
    action: string;          // ROLE_ASSIGN, ROLE_REMOVE
    targetUserId: number;    // User receiving/losing role
    roleId: number;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.auditLogRepository.save({
        userid: data.userId,
        action: data.action,
        resourcetype: 'user_role_assignment',
        resourceid: data.targetUserId,
        newvalues: { roleId: data.roleId },
        ipaddress: data.ipAddress,
      });
      this.logger.log(`Logged role assignment: ${data.action} by user ${data.userId}, role ${data.roleId} for user ${data.targetUserId}`);
    } catch (error) {
      this.logger.error(`Failed to log role assignment: ${error.message}`, error.stack);
    }
  }

  /**
   * Log a password change action
   */
  async logPasswordChange(data: {
    userId: number;
    targetUserId: number;
    forced: boolean;         // Admin-forced vs user-initiated
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.auditLogRepository.save({
        userid: data.userId,
        action: 'PASSWORD_CHANGE',
        resourcetype: 'password',
        resourceid: data.targetUserId,
        newvalues: { forced: data.forced },
        ipaddress: data.ipAddress,
      });
      this.logger.log(`Logged password change: user ${data.userId} changed password for user ${data.targetUserId}, forced: ${data.forced}`);
    } catch (error) {
      this.logger.error(`Failed to log password change: ${error.message}`, error.stack);
    }
  }

  /**
   * Log an account lock or unlock action
   */
  async logAccountLockUnlock(data: {
    userId: number;
    targetUserId: number;
    action: 'ACCOUNT_LOCK' | 'ACCOUNT_UNLOCK';
    reason?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.auditLogRepository.save({
        userid: data.userId,
        action: data.action,
        resourcetype: 'account',
        resourceid: data.targetUserId,
        newvalues: { reason: data.reason },
        ipaddress: data.ipAddress,
      });
      this.logger.log(`Logged account action: ${data.action} by user ${data.userId} on user ${data.targetUserId}`);
    } catch (error) {
      this.logger.error(`Failed to log account lock/unlock: ${error.message}`, error.stack);
    }
  }

  /**
   * Get audit trail for a specific resource
   */
  async getAuditTrail(resourceType: string, resourceId: number, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { resourcetype: resourceType, resourceid: resourceId },
      relations: ['user'],
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit history for a specific user (actions performed by this user)
   */
  async getUserAuditHistory(userId: number, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userid: userId },
      relations: ['user'],
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get recent admin actions within specified number of days
   */
  async getRecentAdminActions(days: number = 7, limit: number = 100): Promise<AuditLog[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    return this.auditLogRepository.find({
      where: {
        timestamp: MoreThan(sinceDate),
        action: undefined, // Will be replaced by In() condition below
      },
      relations: ['user'],
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Detect suspicious activities (users with excessive actions in short time)
   */
  async getSuspiciousActivities(threshold: number = 10): Promise<any[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const results = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.userid', 'userId')
      .addSelect('COUNT(*)', 'actionCount')
      .addSelect('user.email', 'userEmail')
      .addSelect('user.fullname', 'userName')
      .leftJoin('audit.user', 'user')
      .where('audit.timestamp >= :oneHourAgo', { oneHourAgo })
      .groupBy('audit.userid')
      .addGroupBy('user.email')
      .addGroupBy('user.fullname')
      .having('COUNT(*) > :threshold', { threshold })
      .getRawMany();

    return results;
  }

  /**
   * Generic audit logging method
   */
  async logAudit(data: AuditLogData): Promise<void> {
    try {
      await this.auditLogRepository.save({
        userid: data.userId,
        action: data.action,
        resourcetype: data.resourceType,
        resourceid: data.resourceId,
        oldvalues: data.oldValues,
        newvalues: data.newValues,
        ipaddress: data.ipAddress,
      });
      this.logger.log(`Logged audit: ${data.action} by user ${data.userId} on ${data.resourceType}:${data.resourceId}`);
    } catch (error) {
      this.logger.error(`Failed to log audit: ${error.message}`, error.stack);
    }
  }
}
