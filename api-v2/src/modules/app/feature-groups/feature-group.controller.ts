import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureGroupService } from './feature-group.service';
import { AuthGuard } from '../../auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';
import { AssignFeatureDto } from './dto/assign-feature.dto';
import { UpdateFeatureAssignmentDto } from './dto/update-feature-assignment.dto';
import { AssignSubFeatureDto } from './dto/assign-sub-feature.dto';

@ApiTags('Feature Groups')
@ApiBearerAuth()
@Controller('feature-groups')
@UseGuards(AuthGuard)
export class FeatureGroupController {
  constructor(private readonly featureGroupService: FeatureGroupService) {}

  @Get()
  @ApiOperation({ summary: 'Get all feature groups with access levels' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feature groups retrieved successfully' })
  async getAllFeatureGroups() {
    return this.featureGroupService.getAllFeatureGroups();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single feature group by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feature group retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feature group not found' })
  async getFeatureGroupById(@Param('id', ParseIntPipe) id: number) {
    return this.featureGroupService.getFeatureGroupById(id);
  }

  @Get('role/:roleId')
  @ApiOperation({ summary: 'Get all feature assignments for a role' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role feature assignments retrieved successfully' })
  async getRoleFeatureAssignments(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.featureGroupService.getRoleFeatureAssignments(roleId);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign a feature group to a role with specific access level' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Feature assigned successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Feature already assigned or invalid data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Role, feature, or access level not found' })
  async assignFeatureToRole(@Body() dto: AssignFeatureDto, @User() currentUser: any) {
    return this.featureGroupService.assignFeatureToRole(
      dto.roleId,
      dto.featureGroupId,
      dto.accessLevelId,
      dto.dataScope || 'all',
      dto.options || {},
      currentUser.id,
    );
  }

  @Put('assignment/:assignmentId')
  @ApiOperation({ summary: 'Update a feature assignment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Assignment updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Assignment not found' })
  async updateFeatureAssignment(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: UpdateFeatureAssignmentDto,
  ) {
    return this.featureGroupService.updateFeatureAssignment(
      assignmentId,
      dto.accessLevelId,
      dto.dataScope,
      dto.options,
    );
  }

  @Delete('role/:roleId/feature/:featureGroupId')
  @ApiOperation({ summary: 'Remove a feature assignment from a role' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feature removed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Assignment not found' })
  async removeFeatureFromRole(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('featureGroupId', ParseIntPipe) featureGroupId: number,
  ) {
    return this.featureGroupService.removeFeatureFromRole(roleId, featureGroupId);
  }

  @Post('assignment/:assignmentId/sub-feature')
  @ApiOperation({ summary: 'Assign a sub-feature to a role feature assignment' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Sub-feature assigned successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Sub-feature already assigned or invalid data' })
  async assignSubFeature(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: AssignSubFeatureDto,
  ) {
    return this.featureGroupService.assignSubFeature(assignmentId, dto.subFeatureId, dto.accessLevelId);
  }

  @Delete('assignment/:assignmentId/sub-feature/:subFeatureId')
  @ApiOperation({ summary: 'Remove a sub-feature assignment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sub-feature removed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sub-feature assignment not found' })
  async removeSubFeature(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Param('subFeatureId', ParseIntPipe) subFeatureId: number,
  ) {
    return this.featureGroupService.removeSubFeature(assignmentId, subFeatureId);
  }

  @Get('role/:roleId/permissions')
  @ApiOperation({ summary: 'Generate and get complete permissions for a role from feature assignments' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permissions generated successfully' })
  async generateRolePermissions(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.featureGroupService.generateRolePermissions(roleId);
  }
}
