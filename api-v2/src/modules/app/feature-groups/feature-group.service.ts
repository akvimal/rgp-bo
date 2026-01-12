import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureGroup } from '../../../entities/feature-group.entity';
import { AccessLevel } from '../../../entities/access-level.entity';
import { SubFeature } from '../../../entities/sub-feature.entity';
import { RoleFeatureAssignment } from '../../../entities/role-feature-assignment.entity';
import { RoleSubFeatureAssignment } from '../../../entities/role-sub-feature-assignment.entity';
import { AppRole } from '../../../entities/approle.entity';
import { PermissionGenerationService } from '../../../core/services/permission-generation.service';

@Injectable()
export class FeatureGroupService {
  private readonly logger = new Logger(FeatureGroupService.name);

  constructor(
    @InjectRepository(FeatureGroup)
    private featureGroupRepo: Repository<FeatureGroup>,
    @InjectRepository(AccessLevel)
    private accessLevelRepo: Repository<AccessLevel>,
    @InjectRepository(SubFeature)
    private subFeatureRepo: Repository<SubFeature>,
    @InjectRepository(RoleFeatureAssignment)
    private roleFeatureRepo: Repository<RoleFeatureAssignment>,
    @InjectRepository(RoleSubFeatureAssignment)
    private roleSubFeatureRepo: Repository<RoleSubFeatureAssignment>,
    @InjectRepository(AppRole)
    private roleRepo: Repository<AppRole>,
    private permissionGenService: PermissionGenerationService,
  ) {}

  /**
   * Get all feature groups with their access levels
   */
  async getAllFeatureGroups(): Promise<FeatureGroup[]> {
    const featureGroups = await this.featureGroupRepo.find({
      where: { active: true },
      relations: ['accessLevels', 'subFeatures', 'subFeatures.accessLevels'],
      order: {
        sortOrder: 'ASC',
      },
    });

    // Filter out inactive access levels and sub-features
    return featureGroups.map(fg => ({
      ...fg,
      accessLevels: fg.accessLevels
        ? fg.accessLevels.filter(al => al.active !== false).sort((a, b) => a.levelOrder - b.levelOrder)
        : [],
      subFeatures: fg.subFeatures
        ? fg.subFeatures.filter(sf => sf.active !== false).map(sf => ({
            ...sf,
            accessLevels: sf.accessLevels
              ? sf.accessLevels.filter(sfal => sfal.active !== false)
              : [],
          })).sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    }));
  }

  /**
   * Get a single feature group by ID
   */
  async getFeatureGroupById(id: number): Promise<FeatureGroup> {
    const featureGroup = await this.featureGroupRepo.findOne({
      where: { id, active: true },
      relations: ['accessLevels', 'subFeatures', 'subFeatures.accessLevels'],
    });

    if (!featureGroup) {
      throw new NotFoundException(`Feature group with ID ${id} not found`);
    }

    return featureGroup;
  }

  /**
   * Get all feature assignments for a role
   */
  async getRoleFeatureAssignments(roleId: number): Promise<RoleFeatureAssignment[]> {
    return this.roleFeatureRepo.find({
      where: { roleId, active: true },
      relations: [
        'featureGroup',
        'accessLevel',
        'subFeatureAssignments',
        'subFeatureAssignments.subFeature',
        'subFeatureAssignments.accessLevel',
      ],
      order: {
        featureGroup: {
          sortOrder: 'ASC',
        },
      },
    });
  }

  /**
   * Assign a feature group to a role with specific access level
   */
  async assignFeatureToRole(
    roleId: number,
    featureGroupId: number,
    accessLevelId: number,
    dataScope: string = 'all',
    options: Record<string, any> = {},
    assignedBy: number,
  ): Promise<RoleFeatureAssignment> {
    // Verify role exists
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Verify feature group exists
    const featureGroup = await this.featureGroupRepo.findOne({ where: { id: featureGroupId } });
    if (!featureGroup) {
      throw new NotFoundException(`Feature group with ID ${featureGroupId} not found`);
    }

    // Verify access level exists and belongs to this feature group
    const accessLevel = await this.accessLevelRepo.findOne({
      where: { id: accessLevelId, featureGroupId },
    });
    if (!accessLevel) {
      throw new NotFoundException(
        `Access level with ID ${accessLevelId} not found for feature group ${featureGroupId}`,
      );
    }

    // Check if assignment already exists
    const existing = await this.roleFeatureRepo.findOne({
      where: { roleId, featureGroupId },
    });

    if (existing) {
      if (existing.active) {
        throw new BadRequestException(
          `Role already has "${featureGroup.displayName}" assigned. Use update endpoint to modify.`,
        );
      }
      // Reactivate existing inactive assignment
      existing.active = true;
      existing.accessLevelId = accessLevelId;
      existing.dataScope = dataScope;
      existing.options = options;
      existing.assignedBy = assignedBy;
      existing.assignedOn = new Date();
      return this.roleFeatureRepo.save(existing);
    }

    // Create new assignment
    const assignment = this.roleFeatureRepo.create({
      roleId,
      featureGroupId,
      accessLevelId,
      dataScope,
      options,
      assignedBy,
      active: true,
    });

    const saved = await this.roleFeatureRepo.save(assignment);

    // Update role to mark it as using feature groups
    if (!role.usesFeatureGroups) {
      role.usesFeatureGroups = true;
      await this.roleRepo.save(role);
    }

    this.logger.log(`Assigned feature "${featureGroup.name}" to role ${roleId} with access level ${accessLevel.levelName}`);

    return saved;
  }

  /**
   * Update a feature assignment for a role
   */
  async updateFeatureAssignment(
    assignmentId: number,
    accessLevelId?: number,
    dataScope?: string,
    options?: Record<string, any>,
  ): Promise<RoleFeatureAssignment> {
    const assignment = await this.roleFeatureRepo.findOne({
      where: { id: assignmentId },
      relations: ['featureGroup', 'accessLevel'],
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    // Update fields if provided
    if (accessLevelId !== undefined) {
      // Verify access level belongs to the same feature group
      const accessLevel = await this.accessLevelRepo.findOne({
        where: { id: accessLevelId, featureGroupId: assignment.featureGroupId },
      });
      if (!accessLevel) {
        throw new NotFoundException(
          `Access level with ID ${accessLevelId} not found for feature group ${assignment.featureGroupId}`,
        );
      }
      assignment.accessLevelId = accessLevelId;
    }

    if (dataScope !== undefined) {
      assignment.dataScope = dataScope;
    }

    if (options !== undefined) {
      assignment.options = options;
    }

    return this.roleFeatureRepo.save(assignment);
  }

  /**
   * Remove a feature assignment from a role (soft delete)
   */
  async removeFeatureFromRole(roleId: number, featureGroupId: number): Promise<RoleFeatureAssignment> {
    const assignment = await this.roleFeatureRepo.findOne({
      where: { roleId, featureGroupId, active: true },
    });

    if (!assignment) {
      throw new NotFoundException(
        `No active assignment found for role ${roleId} and feature group ${featureGroupId}`,
      );
    }

    assignment.active = false;
    return this.roleFeatureRepo.save(assignment);
  }

  /**
   * Assign a sub-feature to a role's feature assignment
   */
  async assignSubFeature(
    roleFeatureAssignmentId: number,
    subFeatureId: number,
    accessLevelId: number,
  ): Promise<RoleSubFeatureAssignment> {
    // Verify role feature assignment exists
    const roleFeatureAssignment = await this.roleFeatureRepo.findOne({
      where: { id: roleFeatureAssignmentId },
    });
    if (!roleFeatureAssignment) {
      throw new NotFoundException(`Role feature assignment with ID ${roleFeatureAssignmentId} not found`);
    }

    // Verify sub-feature exists and belongs to the feature group
    const subFeature = await this.subFeatureRepo.findOne({
      where: { id: subFeatureId },
    });
    if (!subFeature) {
      throw new NotFoundException(`Sub-feature with ID ${subFeatureId} not found`);
    }

    if (subFeature.featureGroupId !== roleFeatureAssignment.featureGroupId) {
      throw new BadRequestException(
        `Sub-feature ${subFeatureId} does not belong to feature group ${roleFeatureAssignment.featureGroupId}`,
      );
    }

    // Check if assignment already exists
    const existing = await this.roleSubFeatureRepo.findOne({
      where: { roleFeatureAssignmentId, subFeatureId },
    });

    if (existing) {
      if (existing.active) {
        throw new BadRequestException(`Sub-feature already assigned`);
      }
      existing.active = true;
      existing.accessLevelId = accessLevelId;
      return this.roleSubFeatureRepo.save(existing);
    }

    // Create new sub-feature assignment
    const assignment = this.roleSubFeatureRepo.create({
      roleFeatureAssignmentId,
      subFeatureId,
      accessLevelId,
      active: true,
    });

    return this.roleSubFeatureRepo.save(assignment);
  }

  /**
   * Remove a sub-feature assignment (soft delete)
   */
  async removeSubFeature(roleFeatureAssignmentId: number, subFeatureId: number): Promise<RoleSubFeatureAssignment> {
    const assignment = await this.roleSubFeatureRepo.findOne({
      where: { roleFeatureAssignmentId, subFeatureId, active: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Sub-feature assignment not found`);
    }

    assignment.active = false;
    return this.roleSubFeatureRepo.save(assignment);
  }

  /**
   * Generate and return the complete permissions for a role based on its feature assignments
   */
  async generateRolePermissions(roleId: number) {
    return this.permissionGenService.generateRolePermissions(roleId);
  }
}
