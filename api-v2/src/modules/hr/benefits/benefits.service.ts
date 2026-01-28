import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BenefitMaster } from '../../../entities/benefit-master.entity';
import { BenefitPolicy } from '../../../entities/benefit-policy.entity';
import { CreateBenefitMasterDto } from './dto/create-benefit-master.dto';
import { CreateBenefitPolicyDto, UpdateBenefitPolicyDto } from './dto/create-benefit-policy.dto';

@Injectable()
export class BenefitsService {
  private readonly logger = new Logger(BenefitsService.name);

  constructor(
    @InjectRepository(BenefitMaster)
    private readonly benefitMasterRepository: Repository<BenefitMaster>,
    @InjectRepository(BenefitPolicy)
    private readonly benefitPolicyRepository: Repository<BenefitPolicy>,
  ) {}

  /**
   * Get all benefit masters (types)
   */
  async findAllMasters(filters?: {
    category?: string;
    active?: boolean;
  }): Promise<BenefitMaster[]> {
    try {
      const query = this.benefitMasterRepository
        .createQueryBuilder('benefit')
        .where('benefit.archive = :archive', { archive: false })
        .orderBy('benefit.benefit_category', 'ASC')
        .addOrderBy('benefit.benefit_name', 'ASC');

      if (filters?.category) {
        query.andWhere('benefit.benefit_category = :category', { category: filters.category });
      }

      if (filters?.active !== undefined) {
        query.andWhere('benefit.active = :active', { active: filters.active });
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error(`Error fetching benefit masters: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all benefit policies
   */
  async findAllPolicies(filters?: {
    benefitId?: number;
    active?: boolean;
  }): Promise<BenefitPolicy[]> {
    try {
      const query = this.benefitPolicyRepository
        .createQueryBuilder('policy')
        .leftJoinAndSelect('policy.benefit', 'benefit')
        .where('policy.archive = :archive', { archive: false })
        .orderBy('benefit.benefit_category', 'ASC')
        .addOrderBy('policy.policy_name', 'ASC');

      if (filters?.benefitId) {
        query.andWhere('policy.benefit_id = :benefitId', { benefitId: filters.benefitId });
      }

      if (filters?.active !== undefined) {
        query.andWhere('policy.active = :active', { active: filters.active });
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error(`Error fetching benefit policies: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get benefit policy by ID
   */
  async findPolicyById(id: number): Promise<BenefitPolicy> {
    try {
      const policy = await this.benefitPolicyRepository.findOne({
        where: { id, archive: false },
        relations: ['benefit', 'enrollments'],
      });

      if (!policy) {
        throw new NotFoundException(`Benefit policy with ID ${id} not found`);
      }

      return policy;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching benefit policy ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get benefit master by ID
   */
  async findMasterById(id: number): Promise<BenefitMaster> {
    try {
      const benefit = await this.benefitMasterRepository.findOne({
        where: { id, archive: false },
        relations: ['policies'],
      });

      if (!benefit) {
        throw new NotFoundException(`Benefit master with ID ${id} not found`);
      }

      return benefit;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching benefit master ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a new benefit master
   */
  async createBenefitMaster(dto: CreateBenefitMasterDto, userId: number): Promise<BenefitMaster> {
    try {
      // Check if benefit code already exists
      const existing = await this.benefitMasterRepository.findOne({
        where: { benefitCode: dto.benefitCode },
      });

      if (existing) {
        throw new ConflictException(`Benefit with code ${dto.benefitCode} already exists`);
      }

      const benefit = this.benefitMasterRepository.create({
        ...dto,
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await this.benefitMasterRepository.save(benefit);

      this.logger.log(`Benefit master created: ${saved.benefitCode} by user ${userId}`);

      return saved;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`Error creating benefit master: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a new benefit policy
   */
  async createBenefitPolicy(dto: CreateBenefitPolicyDto, userId: number): Promise<BenefitPolicy> {
    try {
      // Verify benefit master exists
      await this.findMasterById(dto.benefitId);

      // Validate date range
      if (dto.effectiveTo && new Date(dto.effectiveTo) < new Date(dto.effectiveFrom)) {
        throw new BadRequestException('Effective to date must be after effective from date');
      }

      // Validate coverage configuration
      if (!dto.coverageAmount && !dto.coveragePercentage && !dto.coverageFormula) {
        throw new BadRequestException('At least one coverage configuration is required');
      }

      const policy = this.benefitPolicyRepository.create({
        ...dto,
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await this.benefitPolicyRepository.save(policy);

      this.logger.log(`Benefit policy created: ${saved.policyName} by user ${userId}`);

      return saved;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error creating benefit policy: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update benefit policy
   */
  async updateBenefitPolicy(
    id: number,
    dto: UpdateBenefitPolicyDto,
    userId: number,
  ): Promise<BenefitPolicy> {
    try {
      const policy = await this.findPolicyById(id);

      Object.assign(policy, dto);
      policy.updatedBy = userId;

      const updated = await this.benefitPolicyRepository.save(policy);

      this.logger.log(`Benefit policy updated: ${updated.policyName} by user ${userId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating benefit policy ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Archive benefit policy
   */
  async archiveBenefitPolicy(id: number, userId: number): Promise<void> {
    try {
      const policy = await this.findPolicyById(id);

      policy.archive = true;
      policy.active = false;
      policy.updatedBy = userId;

      await this.benefitPolicyRepository.save(policy);

      this.logger.log(`Benefit policy archived: ${policy.policyName} by user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error archiving benefit policy ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate benefit amount for a user
   * This is a simplified version - actual calculation would be more complex
   */
  async calculateBenefitAmount(
    policyId: number,
    userId: number,
    userSalary?: number,
  ): Promise<{ amount: number; breakdown: any }> {
    try {
      const policy = await this.findPolicyById(policyId);

      let calculatedAmount = 0;
      const breakdown: any = {};

      // Fixed amount
      if (policy.coverageAmount) {
        calculatedAmount = policy.coverageAmount;
        breakdown.type = 'FIXED';
        breakdown.baseAmount = policy.coverageAmount;
      }

      // Percentage-based (requires salary)
      if (policy.coveragePercentage && userSalary) {
        calculatedAmount = (userSalary * policy.coveragePercentage) / 100;
        breakdown.type = 'PERCENTAGE';
        breakdown.percentage = policy.coveragePercentage;
        breakdown.baseSalary = userSalary;
      }

      // Formula-based (would need to evaluate the formula)
      if (policy.coverageFormula) {
        breakdown.type = 'FORMULA';
        breakdown.formula = policy.coverageFormula;
        // TODO: Implement formula evaluation
      }

      breakdown.calculatedAmount = calculatedAmount;

      this.logger.log(`Benefit amount calculated for policy ${policyId}, user ${userId}: ${calculatedAmount}`);

      return {
        amount: calculatedAmount,
        breakdown,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error calculating benefit amount: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get my enrolled benefits
   * Note: This requires the EmployeeBenefitEnrollment entity
   * For now, returns empty array - will be implemented when Enrollments module is ready
   */
  async getMyBenefits(userId: number): Promise<any[]> {
    try {
      // TODO: Implement once Enrollments module is created
      this.logger.log(`Fetching benefits for user ${userId} - Not yet implemented`);
      return [];
    } catch (error) {
      this.logger.error(`Error fetching user benefits: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get eligible benefits for user
   * Note: This requires eligibility rules evaluation
   * For now, returns all active policies - will be enhanced with eligibility rules
   */
  async getEligibleBenefits(userId: number): Promise<BenefitPolicy[]> {
    try {
      // TODO: Implement eligibility rules evaluation
      const policies = await this.findAllPolicies({ active: true });

      this.logger.log(`Fetching eligible benefits for user ${userId}`);

      return policies;
    } catch (error) {
      this.logger.error(`Error fetching eligible benefits: ${error.message}`, error.stack);
      throw error;
    }
  }
}
