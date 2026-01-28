import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EmployeeBenefitEnrollment } from '../../../entities/employee-benefit-enrollment.entity';
import { BenefitPolicy } from '../../../entities/benefit-policy.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';
import { ApproveEnrollmentDto } from './dto/approve-enrollment.dto';
import { EnrollmentStatus } from '../../../entities/enums/hr-policy-benefits.enums';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    @InjectRepository(EmployeeBenefitEnrollment)
    private readonly enrollmentRepository: Repository<EmployeeBenefitEnrollment>,
    @InjectRepository(BenefitPolicy)
    private readonly benefitPolicyRepository: Repository<BenefitPolicy>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Enroll employee in benefit
   */
  async enrollInBenefit(dto: CreateEnrollmentDto, userId: number): Promise<EmployeeBenefitEnrollment> {
    try {
      // 1. Verify benefit policy exists and is active
      const policy = await this.benefitPolicyRepository.findOne({
        where: { id: dto.benefitPolicyId, active: true },
        relations: ['benefit'],
      });

      if (!policy) {
        throw new NotFoundException('Benefit policy not found or inactive');
      }

      // 2. Check for duplicate enrollment
      const existing = await this.enrollmentRepository.findOne({
        where: {
          userId,
          benefitPolicyId: dto.benefitPolicyId,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      if (existing) {
        throw new ConflictException('Already enrolled in this benefit');
      }

      // 3. Validate family coverage if dependents provided
      if (dto.dependents && !policy.familyCoverageAllowed) {
        throw new BadRequestException('Family coverage not allowed for this benefit');
      }

      // 4. TODO: Check eligibility rules

      // 5. Create enrollment
      const enrollment = this.enrollmentRepository.create({
        userId,
        ...dto,
        enrollmentDate: new Date(),
        status: EnrollmentStatus.ACTIVE,
        requiresApproval: false, // Will be set based on policy or rules
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await this.enrollmentRepository.save(enrollment);

      this.logger.log(`User ${userId} enrolled in benefit policy ${dto.benefitPolicyId}`);

      return saved;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error enrolling user: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update enrollment details
   */
  async updateEnrollment(id: number, dto: UpdateEnrollmentDto, userId: number): Promise<EmployeeBenefitEnrollment> {
    try {
      const enrollment = await this.enrollmentRepository.findOne({
        where: { id, userId },
      });

      if (!enrollment) {
        throw new NotFoundException('Enrollment not found');
      }

      Object.assign(enrollment, dto);
      enrollment.updatedBy = userId;

      return await this.enrollmentRepository.save(enrollment);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating enrollment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel enrollment
   */
  async cancelEnrollment(id: number, reason: string, userId: number): Promise<void> {
    try {
      const enrollment = await this.enrollmentRepository.findOne({
        where: { id, userId },
      });

      if (!enrollment) {
        throw new NotFoundException('Enrollment not found');
      }

      enrollment.status = EnrollmentStatus.CANCELLED;
      enrollment.cancellationDate = new Date();
      enrollment.cancellationReason = reason;
      enrollment.active = false;
      enrollment.updatedBy = userId;

      await this.enrollmentRepository.save(enrollment);

      this.logger.log(`Enrollment ${id} cancelled by user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error cancelling enrollment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get my enrollments
   */
  async getMyEnrollments(userId: number): Promise<EmployeeBenefitEnrollment[]> {
    try {
      return await this.enrollmentRepository.find({
        where: { userId, active: true },
        relations: ['benefitPolicy', 'benefitPolicy.benefit'],
        order: { enrollmentDate: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Error fetching enrollments: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all enrollments (admin)
   */
  async getAllEnrollments(filters?: { status?: string; benefitPolicyId?: number }): Promise<EmployeeBenefitEnrollment[]> {
    try {
      const query = this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .leftJoinAndSelect('enrollment.user', 'user')
        .leftJoinAndSelect('enrollment.benefitPolicy', 'policy')
        .leftJoinAndSelect('policy.benefit', 'benefit')
        .where('enrollment.active = :active', { active: true })
        .orderBy('enrollment.enrollmentDate', 'DESC');

      if (filters?.status) {
        query.andWhere('enrollment.status = :status', { status: filters.status });
      }

      if (filters?.benefitPolicyId) {
        query.andWhere('enrollment.benefitPolicyId = :policyId', { policyId: filters.benefitPolicyId });
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error(`Error fetching all enrollments: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Approve or reject enrollment
   */
  async approveEnrollment(id: number, dto: ApproveEnrollmentDto, approverId: number): Promise<EmployeeBenefitEnrollment> {
    try {
      const enrollment = await this.enrollmentRepository.findOne({
        where: { id },
      });

      if (!enrollment) {
        throw new NotFoundException('Enrollment not found');
      }

      if (enrollment.status !== EnrollmentStatus.PENDING) {
        throw new BadRequestException('Only pending enrollments can be approved');
      }

      enrollment.status = dto.approved ? EnrollmentStatus.ACTIVE : EnrollmentStatus.CANCELLED;
      enrollment.approvedBy = approverId;
      enrollment.approvedOn = new Date();
      if (dto.remarks) {
        enrollment.approvalRemarks = dto.remarks;
      }

      if (!dto.approved) {
        enrollment.active = false;
        enrollment.cancellationReason = dto.remarks || 'Rejected by approver';
        enrollment.cancellationDate = new Date();
      }

      const updated = await this.enrollmentRepository.save(enrollment);

      this.logger.log(`Enrollment ${id} ${dto.approved ? 'approved' : 'rejected'} by user ${approverId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error approving enrollment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Bulk enroll users
   */
  async bulkEnrollUsers(dto: BulkEnrollmentDto, adminUserId: number): Promise<{ success: number; failed: number; errors: any[] }> {
    try {
      let success = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const userId of dto.userIds) {
        try {
          await this.enrollInBenefit(
            {
              benefitPolicyId: dto.benefitPolicyId,
              enrollmentType: dto.enrollmentType,
              effectiveFrom: new Date().toISOString().split('T')[0],
            } as CreateEnrollmentDto,
            userId,
          );
          success++;
        } catch (error) {
          failed++;
          errors.push({ userId, error: error.message });
        }
      }

      this.logger.log(`Bulk enrollment completed: ${success} success, ${failed} failed by admin ${adminUserId}`);

      return { success, failed, errors };
    } catch (error) {
      this.logger.error(`Error in bulk enrollment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get enrollment by ID
   */
  async findOne(id: number): Promise<EmployeeBenefitEnrollment> {
    try {
      const enrollment = await this.enrollmentRepository.findOne({
        where: { id },
        relations: ['benefitPolicy', 'benefitPolicy.benefit', 'user'],
      });

      if (!enrollment) {
        throw new NotFoundException(`Enrollment with ID ${id} not found`);
      }

      return enrollment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching enrollment ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get available benefits for enrollment (not already enrolled)
   */
  async getAvailableBenefits(userId: number): Promise<BenefitPolicy[]> {
    try {
      // Get all active benefit policies
      const allPolicies = await this.benefitPolicyRepository.find({
        where: { active: true },
        relations: ['benefit'],
        order: { policyName: 'ASC' },
      });

      // Get user's active enrollments
      const userEnrollments = await this.enrollmentRepository.find({
        where: {
          userId,
          status: EnrollmentStatus.ACTIVE,
          active: true
        },
        select: ['benefitPolicyId'],
      });

      // Create set of enrolled policy IDs
      const enrolledPolicyIds = new Set(userEnrollments.map(e => e.benefitPolicyId));

      // Filter out policies user is already enrolled in
      const availablePolicies = allPolicies.filter(policy => !enrolledPolicyIds.has(policy.id));

      return availablePolicies;
    } catch (error) {
      this.logger.error(`Error fetching available benefits for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
