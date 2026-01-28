import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HrPolicyMaster } from '../../../entities/hr-policy-master.entity';
import { HrPolicyAcknowledgment } from '../../../entities/hr-policy-acknowledgment.entity';
import { CreateHrPolicyDto } from './dto/create-hr-policy.dto';
import { UpdateHrPolicyDto } from './dto/update-hr-policy.dto';
import { AcknowledgePolicyDto } from './dto/acknowledge-policy.dto';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    @InjectRepository(HrPolicyMaster)
    private readonly policyRepository: Repository<HrPolicyMaster>,
    @InjectRepository(HrPolicyAcknowledgment)
    private readonly acknowledgmentRepository: Repository<HrPolicyAcknowledgment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all HR policies with optional filtering
   */
  async findAll(filters?: {
    category?: string;
    active?: boolean;
    mandatory?: boolean;
  }): Promise<HrPolicyMaster[]> {
    try {
      const query = this.policyRepository
        .createQueryBuilder('policy')
        .where('policy.archive = :archive', { archive: false })
        .orderBy('policy.policy_category', 'ASC')
        .addOrderBy('policy.policy_name', 'ASC');

      if (filters?.category) {
        query.andWhere('policy.policy_category = :category', { category: filters.category });
      }

      if (filters?.active !== undefined) {
        query.andWhere('policy.active = :active', { active: filters.active });
      }

      if (filters?.mandatory !== undefined) {
        query.andWhere('policy.is_mandatory = :mandatory', { mandatory: filters.mandatory });
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error(`Error fetching policies: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a single policy by ID
   */
  async findOne(id: number): Promise<HrPolicyMaster> {
    try {
      const policy = await this.policyRepository.findOne({
        where: { id, archive: false },
        relations: ['acknowledgments'],
      });

      if (!policy) {
        throw new NotFoundException(`HR Policy with ID ${id} not found`);
      }

      return policy;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching policy ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get policy by code
   */
  async findByCode(code: string): Promise<HrPolicyMaster> {
    try {
      const policy = await this.policyRepository.findOne({
        where: { policyCode: code, archive: false, active: true },
      });

      if (!policy) {
        throw new NotFoundException(`HR Policy with code ${code} not found`);
      }

      return policy;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching policy ${code}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a new HR policy
   */
  async create(dto: CreateHrPolicyDto, userId: number): Promise<HrPolicyMaster> {
    try {
      // Check if policy code already exists
      const existing = await this.policyRepository.findOne({
        where: { policyCode: dto.policyCode },
      });

      if (existing) {
        throw new ConflictException(`Policy with code ${dto.policyCode} already exists`);
      }

      // Validate date range
      if (dto.effectiveTo && new Date(dto.effectiveTo) < new Date(dto.effectiveFrom)) {
        throw new BadRequestException('Effective to date must be after effective from date');
      }

      const policy = this.policyRepository.create({
        ...dto,
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await this.policyRepository.save(policy);

      this.logger.log(`HR Policy created: ${saved.policyCode} by user ${userId}`);

      return saved;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error creating policy: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an existing HR policy
   */
  async update(id: number, dto: UpdateHrPolicyDto, userId: number): Promise<HrPolicyMaster> {
    try {
      const policy = await this.findOne(id);

      // If policy code is being changed, check for conflicts
      if (dto.policyCode && dto.policyCode !== policy.policyCode) {
        const existing = await this.policyRepository.findOne({
          where: { policyCode: dto.policyCode },
        });

        if (existing) {
          throw new ConflictException(`Policy with code ${dto.policyCode} already exists`);
        }
      }

      // Validate date range if being updated
      const effectiveFrom = dto.effectiveFrom || policy.effectiveFrom;
      const effectiveTo = dto.effectiveTo || policy.effectiveTo;

      if (effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) {
        throw new BadRequestException('Effective to date must be after effective from date');
      }

      // Increment version if policy content is changed
      if (dto.policyContent) {
        policy.version += 1;
      }

      Object.assign(policy, dto);
      policy.updatedBy = userId;

      const updated = await this.policyRepository.save(policy);

      this.logger.log(`HR Policy updated: ${updated.policyCode} by user ${userId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating policy ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Archive a policy (soft delete)
   */
  async archive(id: number, userId: number): Promise<void> {
    try {
      const policy = await this.findOne(id);

      policy.archive = true;
      policy.active = false;
      policy.updatedBy = userId;

      await this.policyRepository.save(policy);

      this.logger.log(`HR Policy archived: ${policy.policyCode} by user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error archiving policy ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get policies applicable to a user
   */
  async getMyPolicies(userId: number): Promise<HrPolicyMaster[]> {
    try {
      // For now, return all active mandatory policies
      // In future, this can be enhanced with eligibility rules
      const policies = await this.policyRepository.find({
        where: {
          active: true,
          archive: false,
        },
        order: {
          policyCategory: 'ASC',
          policyName: 'ASC',
        },
      });

      // Get user's acknowledgments
      const acknowledgments = await this.acknowledgmentRepository.find({
        where: { userId },
        select: ['policyId', 'policyVersion'],
      });

      // Mark policies as acknowledged if user has acknowledged them
      const acknowledgedPolicies = acknowledgments.reduce((acc, ack) => {
        acc[ack.policyId] = ack.policyVersion;
        return acc;
      }, {});

      // Add acknowledgment status to policies
      policies.forEach((policy: any) => {
        policy.isAcknowledged = acknowledgedPolicies[policy.id] === policy.version;
      });

      return policies;
    } catch (error) {
      this.logger.error(`Error fetching policies for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Acknowledge a policy
   */
  async acknowledgePolicy(
    policyId: number,
    dto: AcknowledgePolicyDto,
    userId: number,
  ): Promise<HrPolicyAcknowledgment> {
    try {
      const policy = await this.findOne(policyId);

      // Check if already acknowledged for this version
      const existing = await this.acknowledgmentRepository.findOne({
        where: {
          userId,
          policyId,
          policyVersion: policy.version,
        },
      });

      if (existing) {
        throw new ConflictException('Policy already acknowledged for this version');
      }

      const acknowledgment = this.acknowledgmentRepository.create({
        userId,
        policyId,
        policyVersion: policy.version,
        policyContentSnapshot: policy.policyContent,
        ...dto,
      });

      const saved = await this.acknowledgmentRepository.save(acknowledgment);

      this.logger.log(`Policy ${policyId} acknowledged by user ${userId}`);

      return saved;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.error(`Error acknowledging policy ${policyId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get policy version history
   */
  async getPolicyHistory(policyCode: string): Promise<HrPolicyMaster[]> {
    try {
      return await this.policyRepository.find({
        where: { policyCode },
        order: { version: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Error fetching policy history for ${policyCode}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get policy acknowledgments
   */
  async getPolicyAcknowledgments(policyId: number): Promise<HrPolicyAcknowledgment[]> {
    try {
      await this.findOne(policyId); // Verify policy exists

      return await this.acknowledgmentRepository.find({
        where: { policyId },
        relations: ['user'],
        order: { acknowledgedOn: 'DESC' },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching acknowledgments for policy ${policyId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
