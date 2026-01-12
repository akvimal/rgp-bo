import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleAssignment } from '../../../entities/user-role-assignment.entity';
import { AppUser } from '../../../entities/appuser.entity';
import { AppRole } from '../../../entities/approle.entity';
import { PermissionService } from '../../../core/services/permission.service';

/**
 * UserRoleService
 *
 * Handles multi-role assignment operations:
 * - Assign roles to users
 * - Remove role assignments
 * - Get user's roles
 * - Prevent duplicate assignments
 */
@Injectable()
export class UserRoleService {
  constructor(
    @InjectRepository(UserRoleAssignment)
    private readonly assignmentRepo: Repository<UserRoleAssignment>,
    @InjectRepository(AppUser)
    private readonly userRepo: Repository<AppUser>,
    @InjectRepository(AppRole)
    private readonly roleRepo: Repository<AppRole>,
    private readonly permissionService: PermissionService
  ) {}

  /**
   * Get all active roles for a user
   *
   * @param userId - User ID to get roles for
   * @returns Array of role assignments with role details
   */
  async getUserRoles(userId: number): Promise<UserRoleAssignment[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.assignmentRepo.find({
      where: { user_id: userId, active: true },
      relations: ['role'],
      order: { assigned_on: 'DESC' }
    });
  }

  /**
   * Assign a role to a user
   *
   * @param userId - User ID to assign role to
   * @param roleId - Role ID to assign
   * @param assignedBy - User ID who is making the assignment
   * @returns Created role assignment
   *
   * @throws NotFoundException if user or role doesn't exist
   * @throws BadRequestException if role is already assigned
   */
  async assignRole(
    userId: number,
    roleId: number,
    assignedBy: number
  ): Promise<UserRoleAssignment> {
    // Verify user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify role exists
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if assignment already exists (active or inactive)
    const existing = await this.assignmentRepo.findOne({
      where: { user_id: userId, role_id: roleId }
    });

    if (existing) {
      if (existing.active) {
        throw new BadRequestException(
          `User already has role "${role.name}" assigned`
        );
      }

      // Reactivate existing inactive assignment
      existing.active = true;
      existing.assigned_by = assignedBy;
      existing.assigned_on = new Date();
      return this.assignmentRepo.save(existing);
    }

    // Create new assignment
    const assignment = this.assignmentRepo.create({
      user_id: userId,
      role_id: roleId,
      assigned_by: assignedBy,
      active: true
    });

    return this.assignmentRepo.save(assignment);
  }

  /**
   * Remove a role from a user (soft delete - marks as inactive)
   *
   * @param userId - User ID to remove role from
   * @param roleId - Role ID to remove
   * @returns Updated role assignment (inactive)
   *
   * @throws NotFoundException if user, role, or assignment doesn't exist
   * @throws BadRequestException if trying to remove user's last role
   */
  async removeRole(userId: number, roleId: number): Promise<UserRoleAssignment> {
    // Check user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Find assignment
    const assignment = await this.assignmentRepo.findOne({
      where: { user_id: userId, role_id: roleId, active: true },
      relations: ['role']
    });

    if (!assignment) {
      throw new NotFoundException(
        `Active role assignment not found for user ${userId} and role ${roleId}`
      );
    }

    // Check if this is the user's last active role
    const activeRoles = await this.assignmentRepo.count({
      where: { user_id: userId, active: true }
    });

    if (activeRoles <= 1) {
      throw new BadRequestException(
        'Cannot remove last role from user. User must have at least one active role.'
      );
    }

    // Soft delete - mark as inactive
    assignment.active = false;
    return this.assignmentRepo.save(assignment);
  }

  /**
   * Get merged permissions for a user from all their active roles
   *
   * @param userId - User ID to get permissions for
   * @returns Merged permission array
   */
  async getUserPermissions(userId: number) {
    return this.permissionService.resolveUserPermissions(userId);
  }

  /**
   * Get all role IDs for a user
   *
   * @param userId - User ID to get role IDs for
   * @returns Array of role IDs
   */
  async getUserRoleIds(userId: number): Promise<number[]> {
    return this.permissionService.getUserRoleIds(userId);
  }
}
