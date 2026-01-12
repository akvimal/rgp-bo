import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  ParseIntPipe,
  NotFoundException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { UserRoleService } from './user-role.service';
import { User } from '../../../core/decorator/user.decorator';
import { AuthHelper } from '../../auth/auth.helper';
import { UserService } from './user.service';

/**
 * DTO for assigning a role to a user
 */
class AssignRoleDto {
  userId: number;
  roleId: number;
}

/**
 * UserRoleController
 *
 * Manages multi-role assignments for users
 *
 * Endpoints:
 * - GET /users/roles/:userId - Get all roles for user
 * - POST /users/roles/assign - Assign role to user
 * - DELETE /users/roles/:userId/:roleId - Remove role from user
 * - POST /users/roles/:userId/refresh-token - Get new JWT with updated permissions
 */
@ApiTags('User Roles')
@ApiBearerAuth()
@Controller('users/roles')
@UseGuards(AuthGuard)
export class UserRoleController {
  constructor(
    private readonly userRoleService: UserRoleService,
    private readonly userService: UserService,
    private readonly authHelper: AuthHelper
  ) {}

  /**
   * Get all active roles for a user
   *
   * @param userId - User ID to get roles for
   * @returns Array of role assignments with role details
   */
  @Get(':userId')
  @ApiOperation({ summary: 'Get all active roles for a user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns array of role assignments'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found'
  })
  async getUserRoles(
    @Param('userId', ParseIntPipe) userId: number
  ) {
    return this.userRoleService.getUserRoles(userId);
  }

  /**
   * Assign a role to a user
   *
   * @param dto - Contains userId and roleId to assign
   * @param currentUser - Currently authenticated user (from JWT)
   * @returns Created role assignment
   */
  @Post('assign')
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Role assigned successfully'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Role already assigned or invalid data'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or role not found'
  })
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

  /**
   * Remove a role from a user (soft delete)
   *
   * @param userId - User ID to remove role from
   * @param roleId - Role ID to remove
   * @returns Updated role assignment (marked inactive)
   */
  @Delete(':userId/:roleId')
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Role removed successfully'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot remove last role from user'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User, role, or assignment not found'
  })
  async removeRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number
  ) {
    return this.userRoleService.removeRole(userId, roleId);
  }

  /**
   * Generate a new JWT token with updated permissions for a user
   *
   * Useful after role assignments change to immediately reflect new permissions
   * without requiring re-login
   *
   * @param userId - User ID to generate token for
   * @returns New JWT token with merged permissions
   */
  @Post(':userId/refresh-token')
  @ApiOperation({
    summary: 'Generate new JWT token with updated permissions',
    description: 'Call this after modifying user roles to get updated JWT'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns new JWT token'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found'
  })
  async refreshToken(
    @Param('userId', ParseIntPipe) userId: number
  ) {
    // Get user details
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Generate new token with current permissions
    const token = await this.authHelper.generateToken(user);

    return { token };
  }

  /**
   * Get merged permissions for a user
   *
   * For debugging/testing - see what permissions a user has
   *
   * @param userId - User ID to get permissions for
   * @returns Merged permission array
   */
  @Get(':userId/permissions')
  @ApiOperation({
    summary: 'Get merged permissions for a user',
    description: 'For debugging - shows merged permissions from all roles'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns merged permission array'
  })
  async getUserPermissions(
    @Param('userId', ParseIntPipe) userId: number
  ) {
    return this.userRoleService.getUserPermissions(userId);
  }

  /**
   * Get all role IDs for a user
   *
   * For debugging/testing
   *
   * @param userId - User ID to get role IDs for
   * @returns Array of role IDs
   */
  @Get(':userId/role-ids')
  @ApiOperation({
    summary: 'Get all role IDs for a user',
    description: 'For debugging - shows all role IDs assigned to user'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns array of role IDs'
  })
  async getUserRoleIds(
    @Param('userId', ParseIntPipe) userId: number
  ) {
    const roleIds = await this.userRoleService.getUserRoleIds(userId);
    return { roleIds };
  }
}
