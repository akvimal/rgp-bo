import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BenefitClaim } from '../../../entities/benefit-claim.entity';
import { EmployeeBenefitEnrollment } from '../../../entities/employee-benefit-enrollment.entity';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { ApproveClaimDto } from './dto/approve-claim.dto';
import { RejectClaimDto } from './dto/reject-claim.dto';
import { PayClaimDto } from './dto/pay-claim.dto';
import { ClaimStatus } from '../../../entities/enums/hr-policy-benefits.enums';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    @InjectRepository(BenefitClaim)
    private readonly claimRepository: Repository<BenefitClaim>,
    @InjectRepository(EmployeeBenefitEnrollment)
    private readonly enrollmentRepository: Repository<EmployeeBenefitEnrollment>,
  ) {}

  /**
   * Generate unique claim number
   */
  private async generateClaimNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Count claims for this month
    const count = await this.claimRepository
      .createQueryBuilder('claim')
      .where('EXTRACT(YEAR FROM claim.claim_date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM claim.claim_date) = :month', { month: date.getMonth() + 1 })
      .getCount();

    return `CLM${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Submit new claim
   */
  async submitClaim(dto: SubmitClaimDto, userId: number): Promise<BenefitClaim> {
    try {
      // 1. Verify enrollment exists and is active
      const enrollment = await this.enrollmentRepository.findOne({
        where: { id: dto.enrollmentId, userId, active: true },
        relations: ['benefitPolicy'],
      });

      if (!enrollment) {
        throw new NotFoundException('Active enrollment not found');
      }

      // 2. Validate claimed amount against policy limits
      const policy = enrollment.benefitPolicy;
      if (policy.coverageAmount && dto.claimedAmount > policy.coverageAmount) {
        throw new BadRequestException(`Claimed amount exceeds policy limit of ${policy.coverageAmount}`);
      }

      // 3. Check claims limit per year
      if (policy.maxClaimsPerYear) {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const claimsThisYear = await this.claimRepository
          .createQueryBuilder('claim')
          .where('claim.user_id = :userId', { userId })
          .andWhere('claim.benefit_policy_id = :policyId', { policyId: dto.benefitPolicyId })
          .andWhere('claim.claim_date >= :yearStart', { yearStart })
          .getCount();

        if (claimsThisYear >= policy.maxClaimsPerYear) {
          throw new BadRequestException(`Maximum claims per year (${policy.maxClaimsPerYear}) exceeded`);
        }
      }

      // 4. Generate claim number
      const claimNumber = await this.generateClaimNumber();

      // 5. Create claim
      const claim = this.claimRepository.create({
        ...dto,
        userId,
        claimNumber,
        claimDate: new Date(),
        status: ClaimStatus.SUBMITTED,
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await this.claimRepository.save(claim);

      this.logger.log(`Claim ${claimNumber} submitted by user ${userId}`);

      return saved;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error submitting claim: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get my claims
   */
  async getMyClaims(userId: number): Promise<BenefitClaim[]> {
    try {
      return await this.claimRepository.find({
        where: { userId },
        relations: ['benefitPolicy', 'benefitPolicy.benefit'],
        order: { claimDate: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Error fetching claims: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get pending claims for review
   */
  async getPendingClaims(reviewerId: number): Promise<BenefitClaim[]> {
    try {
      return await this.claimRepository.find({
        where: [
          { status: ClaimStatus.SUBMITTED },
          { status: ClaimStatus.UNDER_REVIEW },
        ],
        relations: ['user', 'benefitPolicy', 'benefitPolicy.benefit'],
        order: { claimDate: 'ASC' },
      });
    } catch (error) {
      this.logger.error(`Error fetching pending claims: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Review claim
   */
  async reviewClaim(id: number, dto: ReviewClaimDto, reviewerId: number): Promise<BenefitClaim> {
    try {
      const claim = await this.claimRepository.findOne({ where: { id } });

      if (!claim) {
        throw new NotFoundException('Claim not found');
      }

      if (claim.status !== ClaimStatus.SUBMITTED) {
        throw new BadRequestException('Only submitted claims can be reviewed');
      }

      claim.status = ClaimStatus.UNDER_REVIEW;
      claim.reviewedBy = reviewerId;
      claim.reviewedOn = new Date();
      if (dto.reviewerRemarks) {
        claim.reviewerRemarks = dto.reviewerRemarks;
      }
      if (dto.approvedAmount !== undefined) {
        claim.approvedAmount = dto.approvedAmount;
      }
      if (dto.rejectedAmount !== undefined) {
        claim.rejectedAmount = dto.rejectedAmount;
      }
      claim.updatedBy = reviewerId;

      return await this.claimRepository.save(claim);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error reviewing claim: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Approve claim
   */
  async approveClaim(id: number, dto: ApproveClaimDto, approverId: number): Promise<BenefitClaim> {
    try {
      const claim = await this.claimRepository.findOne({ where: { id } });

      if (!claim) {
        throw new NotFoundException('Claim not found');
      }

      if (claim.status === ClaimStatus.APPROVED || claim.status === ClaimStatus.PAID) {
        throw new BadRequestException('Claim already approved');
      }

      claim.status = ClaimStatus.APPROVED;
      claim.approvedBy = approverId;
      claim.approvedOn = new Date();
      claim.approvedAmount = dto.approvedAmount;
      if (dto.approvalRemarks) {
        claim.approvalRemarks = dto.approvalRemarks;
      }
      claim.updatedBy = approverId;

      const updated = await this.claimRepository.save(claim);

      this.logger.log(`Claim ${claim.claimNumber} approved by user ${approverId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error approving claim: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reject claim
   */
  async rejectClaim(id: number, dto: RejectClaimDto, approverId: number): Promise<BenefitClaim> {
    try {
      const claim = await this.claimRepository.findOne({ where: { id } });

      if (!claim) {
        throw new NotFoundException('Claim not found');
      }

      if (claim.status === ClaimStatus.REJECTED) {
        throw new BadRequestException('Claim already rejected');
      }

      claim.status = ClaimStatus.REJECTED;
      claim.rejectionReason = dto.rejectionReason;
      claim.approvedBy = approverId;
      claim.approvedOn = new Date();
      claim.updatedBy = approverId;

      const updated = await this.claimRepository.save(claim);

      this.logger.log(`Claim ${claim.claimNumber} rejected by user ${approverId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error rejecting claim: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark claim as paid
   */
  async markAsPaid(id: number, dto: PayClaimDto, userId: number): Promise<BenefitClaim> {
    try {
      const claim = await this.claimRepository.findOne({ where: { id } });

      if (!claim) {
        throw new NotFoundException('Claim not found');
      }

      if (claim.status !== ClaimStatus.APPROVED) {
        throw new BadRequestException('Only approved claims can be marked as paid');
      }

      claim.status = ClaimStatus.PAID;
      claim.paymentMode = dto.paymentMode;
      if (dto.paymentReference) {
        claim.paymentReference = dto.paymentReference;
      }
      claim.paymentDate = new Date(dto.paymentDate);
      if (dto.payrollRunId) {
        claim.payrollRunId = dto.payrollRunId;
      }
      claim.paidAmount = claim.approvedAmount;
      claim.updatedBy = userId;

      const updated = await this.claimRepository.save(claim);

      this.logger.log(`Claim ${claim.claimNumber} marked as paid by user ${userId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error marking claim as paid: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get claim by ID
   */
  async getClaimById(id: number): Promise<BenefitClaim> {
    try {
      const claim = await this.claimRepository.findOne({
        where: { id },
        relations: ['user', 'benefitPolicy', 'benefitPolicy.benefit', 'enrollment'],
      });

      if (!claim) {
        throw new NotFoundException('Claim not found');
      }

      return claim;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error fetching claim: ${error.message}`, error.stack);
      throw error;
    }
  }
}
