# HR Policy & Benefits - Phase 3 Implementation Templates

## Overview
This document provides code templates for implementing the Enrollments and Claims modules, based on the patterns established in the Policies and Benefits modules.

**Purpose**: Complete Phase 3 by implementing modules 3 and 4
**Time Estimate**: 10-12 hours total
**Prerequisites**: Policies and Benefits modules complete ✅

---

## Module 3: Enrollments Implementation Guide

### Directory Structure
```
api-v2/src/modules/hr/enrollments/
├── dto/
│   ├── create-enrollment.dto.ts
│   ├── update-enrollment.dto.ts
│   ├── bulk-enrollment.dto.ts
│   └── approve-enrollment.dto.ts
├── enrollments.service.ts
└── enrollments.controller.ts
```

### Step 1: Create DTOs

#### File: `dto/create-enrollment.dto.ts`

```typescript
import { IsNumber, IsEnum, IsNotEmpty, IsOptional, IsDateString, IsObject, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentType } from '../../../../entities/enums/hr-policy-benefits.enums';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 1, description: 'Benefit policy ID' })
  @IsNumber()
  @IsNotEmpty()
  benefitPolicyId: number;

  @ApiPropertyOptional({ enum: EnrollmentType, default: EnrollmentType.VOLUNTARY })
  @IsOptional()
  @IsEnum(EnrollmentType)
  enrollmentType?: EnrollmentType;

  @ApiPropertyOptional({ example: 350000 })
  @IsOptional()
  @IsNumber()
  customCoverageAmount?: number;

  @ApiPropertyOptional({ example: 600 })
  @IsOptional()
  @IsNumber()
  customEmployeeContribution?: number;

  @ApiPropertyOptional({
    example: [
      {
        name: 'Jane Doe',
        relationship: 'SPOUSE',
        dob: '1992-05-15',
        gender: 'F',
        coverageAmount: 300000,
      },
    ],
    description: 'Array of dependent details',
  })
  @IsOptional()
  @IsObject()
  dependents?: Record<string, any>;

  @ApiPropertyOptional({ example: 'John Doe Sr' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomineeName?: string;

  @ApiPropertyOptional({ example: 'FATHER' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nomineeRelationship?: string;

  @ApiPropertyOptional({ example: '1970-03-20' })
  @IsOptional()
  @IsDateString()
  nomineeDob?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nomineeContact?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  nomineePercentage?: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
```

#### File: `dto/update-enrollment.dto.ts`

```typescript
import { IsOptional, IsObject, IsString, IsNumber, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEnrollmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  customCoverageAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  customEmployeeContribution?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dependents?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomineeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nomineeRelationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nomineeDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nomineeContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  nomineePercentage?: number;
}
```

#### File: `dto/bulk-enrollment.dto.ts`

```typescript
import { IsNumber, IsArray, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentType } from '../../../../entities/enums/hr-policy-benefits.enums';

export class BulkEnrollmentDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  benefitPolicyId: number;

  @ApiProperty({ example: [2, 3, 4], description: 'Array of user IDs to enroll' })
  @IsArray()
  @IsNotEmpty()
  userIds: number[];

  @ApiPropertyOptional({ enum: EnrollmentType, default: EnrollmentType.AUTO })
  @IsOptional()
  @IsEnum(EnrollmentType)
  enrollmentType?: EnrollmentType;
}
```

#### File: `dto/approve-enrollment.dto.ts`

```typescript
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveEnrollmentDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;

  @ApiPropertyOptional({ example: 'Enrollment approved as per eligibility criteria' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
```

### Step 2: Create Service

#### File: `enrollments.service.ts`

**Key Methods to Implement**:

```typescript
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
        status: policy.requiresApproval ? EnrollmentStatus.PENDING : EnrollmentStatus.ACTIVE,
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
      enrollment.approvalRemarks = dto.remarks;

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
}
```

### Step 3: Create Controller

#### File: `enrollments.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { User } from '../../../core/decorator/user.decorator';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';
import { ApproveEnrollmentDto } from './dto/approve-enrollment.dto';

@ApiTags('Benefit Enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Enroll in a benefit' })
  @ApiResponse({ status: 201, description: 'Enrolled successfully' })
  @ApiResponse({ status: 404, description: 'Benefit policy not found' })
  @ApiResponse({ status: 409, description: 'Already enrolled' })
  async enrollInBenefit(@Body() createDto: CreateEnrollmentDto, @User() user: any) {
    return await this.enrollmentsService.enrollInBenefit(createDto, user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my enrollments' })
  @ApiResponse({ status: 200, description: 'Enrollments retrieved successfully' })
  async getMyEnrollments(@User() user: any) {
    return await this.enrollmentsService.getMyEnrollments(user.id);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all enrollments (admin)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'benefitPolicyId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'All enrollments retrieved successfully' })
  async getAllEnrollments(
    @Query('status') status?: string,
    @Query('benefitPolicyId') benefitPolicyId?: string,
  ) {
    const filters = {
      status,
      benefitPolicyId: benefitPolicyId ? parseInt(benefitPolicyId) : undefined,
    };
    return await this.enrollmentsService.getAllEnrollments(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get enrollment by ID' })
  @ApiResponse({ status: 200, description: 'Enrollment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async getEnrollmentById(@Param('id', ParseIntPipe) id: number) {
    // TODO: Implement findOne method in service
    return { message: 'Not implemented' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment updated successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async updateEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateEnrollmentDto,
    @User() user: any,
  ) {
    return await this.enrollmentsService.updateEnrollment(id, updateDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel enrollment' })
  @ApiResponse({ status: 204, description: 'Enrollment cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async cancelEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason: string,
    @User() user: any,
  ) {
    await this.enrollmentsService.cancelEnrollment(id, reason, user.id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve or reject enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid enrollment status' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async approveEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Body() approveDto: ApproveEnrollmentDto,
    @User() user: any,
  ) {
    return await this.enrollmentsService.approveEnrollment(id, approveDto, user.id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk enroll users in benefit' })
  @ApiResponse({ status: 201, description: 'Bulk enrollment completed' })
  async bulkEnrollUsers(@Body() bulkDto: BulkEnrollmentDto, @User() user: any) {
    return await this.enrollmentsService.bulkEnrollUsers(bulkDto, user.id);
  }
}
```

---

## Module 4: Claims Implementation Guide

### Directory Structure
```
api-v2/src/modules/hr/claims/
├── dto/
│   ├── submit-claim.dto.ts
│   ├── review-claim.dto.ts
│   ├── approve-claim.dto.ts
│   ├── reject-claim.dto.ts
│   └── pay-claim.dto.ts
├── claims.service.ts
└── claims.controller.ts
```

### Step 1: Create DTOs

#### File: `dto/submit-claim.dto.ts`

```typescript
import { IsNumber, IsEnum, IsNotEmpty, IsOptional, IsDateString, IsString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClaimType } from '../../../../entities/enums/hr-policy-benefits.enums';

export class SubmitClaimDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  enrollmentId: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  benefitPolicyId: number;

  @ApiProperty({ enum: ClaimType, example: ClaimType.REIMBURSEMENT })
  @IsEnum(ClaimType)
  @IsNotEmpty()
  claimType: ClaimType;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @IsNotEmpty()
  claimedAmount: number;

  @ApiPropertyOptional({ example: '2026-01-10' })
  @IsOptional()
  @IsDateString()
  incidentDate?: string;

  @ApiProperty({ example: 'Medical expenses for hospitalization' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: [
      { filename: 'invoice.pdf', url: '/uploads/invoice.pdf', type: 'invoice' },
      { filename: 'prescription.pdf', url: '/uploads/prescription.pdf', type: 'prescription' },
    ],
  })
  @IsOptional()
  @IsObject()
  documents?: Record<string, any>;
}
```

#### File: `dto/review-claim.dto.ts`

```typescript
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewClaimDto {
  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @IsNumber()
  approvedAmount?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @IsNumber()
  rejectedAmount?: number;

  @ApiPropertyOptional({ example: 'Reviewed documents, approved partial amount' })
  @IsOptional()
  @IsString()
  reviewerRemarks?: string;
}
```

#### File: `dto/approve-claim.dto.ts`

```typescript
import { IsNumber, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveClaimDto {
  @ApiProperty({ example: 12000 })
  @IsNumber()
  @IsNotEmpty()
  approvedAmount: number;

  @ApiPropertyOptional({ example: 'Approved as per policy limits' })
  @IsOptional()
  @IsString()
  approvalRemarks?: string;
}
```

#### File: `dto/reject-claim.dto.ts`

```typescript
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectClaimDto {
  @ApiProperty({ example: 'Insufficient documentation provided' })
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}
```

#### File: `dto/pay-claim.dto.ts`

```typescript
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMode } from '../../../../entities/enums/hr-policy-benefits.enums';

export class PayClaimDto {
  @ApiProperty({ enum: PaymentMode, example: PaymentMode.BANK_TRANSFER })
  @IsEnum(PaymentMode)
  @IsNotEmpty()
  paymentMode: PaymentMode;

  @ApiPropertyOptional({ example: 'TXN123456789' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  @IsNotEmpty()
  paymentDate: string;

  @ApiPropertyOptional({ example: 123 })
  @IsOptional()
  @IsNumber()
  payrollRunId?: number;
}
```

### Step 2: Create Service Template

#### File: `claims.service.ts` (Key Methods)

```typescript
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
        const claimsThisYear = await this.claimRepository.count({
          where: {
            userId,
            benefitPolicyId: dto.benefitPolicyId,
            claimDate: yearStart as any, // Greater than year start
          },
        });

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
      claim.reviewerRemarks = dto.reviewerRemarks;
      claim.approvedAmount = dto.approvedAmount;
      claim.rejectedAmount = dto.rejectedAmount;
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
      claim.approvalRemarks = dto.approvalRemarks;
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
      claim.paymentReference = dto.paymentReference;
      claim.paymentDate = new Date(dto.paymentDate);
      claim.payrollRunId = dto.payrollRunId;
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
```

### Step 3: Create Controller Template

#### File: `claims.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { User } from '../../../core/decorator/user.decorator';
import { ClaimsService } from './claims.service';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { ApproveClaimDto } from './dto/approve-claim.dto';
import { RejectClaimDto } from './dto/reject-claim.dto';
import { PayClaimDto } from './dto/pay-claim.dto';

@ApiTags('Benefit Claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new claim' })
  @ApiResponse({ status: 201, description: 'Claim submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim data' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async submitClaim(@Body() submitDto: SubmitClaimDto, @User() user: any) {
    return await this.claimsService.submitClaim(submitDto, user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my claims' })
  @ApiResponse({ status: 200, description: 'Claims retrieved successfully' })
  async getMyClaims(@User() user: any) {
    return await this.claimsService.getMyClaims(user.id);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending claims for review' })
  @ApiResponse({ status: 200, description: 'Pending claims retrieved successfully' })
  async getPendingClaims(@User() user: any) {
    return await this.claimsService.getPendingClaims(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiResponse({ status: 200, description: 'Claim retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async getClaimById(@Param('id', ParseIntPipe) id: number) {
    return await this.claimsService.getClaimById(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review a claim' })
  @ApiResponse({ status: 200, description: 'Claim reviewed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async reviewClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() reviewDto: ReviewClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.reviewClaim(id, reviewDto, user.id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a claim' })
  @ApiResponse({ status: 200, description: 'Claim approved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async approveClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() approveDto: ApproveClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.approveClaim(id, approveDto, user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a claim' })
  @ApiResponse({ status: 200, description: 'Claim rejected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async rejectClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() rejectDto: RejectClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.rejectClaim(id, rejectDto, user.id);
  }

  @Patch(':id/pay')
  @ApiOperation({ summary: 'Mark claim as paid' })
  @ApiResponse({ status: 200, description: 'Claim marked as paid successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async markAsPaid(
    @Param('id', ParseIntPipe) id: number,
    @Body() payDto: PayClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.markAsPaid(id, payDto, user.id);
  }
}
```

---

## Module Registration in HrModule

### File: `hr.module.ts` (Updated)

Add the following imports and registrations:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Existing imports...

// NEW: Policy & Benefits Entities
import { HrPolicyMaster } from '../../entities/hr-policy-master.entity';
import { HrPolicyAcknowledgment } from '../../entities/hr-policy-acknowledgment.entity';
import { BenefitMaster } from '../../entities/benefit-master.entity';
import { BenefitPolicy } from '../../entities/benefit-policy.entity';
import { EmployeeBenefitEnrollment } from '../../entities/employee-benefit-enrollment.entity';
import { BenefitClaim } from '../../entities/benefit-claim.entity';
import { PolicyEligibilityRule } from '../../entities/policy-eligibility-rule.entity';

// NEW: Services
import { PoliciesService } from './policies/policies.service';
import { BenefitsService } from './benefits/benefits.service';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { ClaimsService } from './claims/claims.service';

// NEW: Controllers
import { PoliciesController } from './policies/policies.controller';
import { BenefitsController } from './benefits/benefits.controller';
import { EnrollmentsController } from './enrollments/enrollments.controller';
import { ClaimsController } from './claims/claims.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Existing entities...
      Shift,
      UserShift,
      Attendance,
      LeaveType,
      LeaveRequest,
      LeaveBalance,
      UserScore,
      SystemPerformanceLog,
      ApiUsageLog,
      QueryPerformanceLog,
      HrAuditLog,

      // NEW: Policy & Benefits entities
      HrPolicyMaster,
      HrPolicyAcknowledgment,
      BenefitMaster,
      BenefitPolicy,
      EmployeeBenefitEnrollment,
      BenefitClaim,
      PolicyEligibilityRule,
    ]),
    RedisCacheModule,
    AuthModule,
  ],
  controllers: [
    // Existing controllers...
    ShiftController,
    AttendanceController,
    LeaveController,
    ScoringController,
    ReportingController,

    // NEW: Policy & Benefits controllers
    PoliciesController,
    BenefitsController,
    EnrollmentsController,
    ClaimsController,
  ],
  providers: [
    // Existing providers...
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    PerformanceMonitoringService,
    HrTasksService,

    // NEW: Policy & Benefits services
    PoliciesService,
    BenefitsService,
    EnrollmentsService,
    ClaimsService,
  ],
  exports: [
    // Existing exports...
    ShiftService,
    AttendanceService,
    LeaveService,
    ScoringService,
    ReportingService,
    PerformanceMonitoringService,

    // NEW: Policy & Benefits exports
    PoliciesService,
    BenefitsService,
    EnrollmentsService,
    ClaimsService,
  ],
})
export class HrModule {}
```

---

## Testing Checklist

### Build & Start
```bash
cd api-v2
npm run build
npm run start:dev
```

### Test Endpoints via Swagger
Navigate to: `http://localhost:3000/api`

#### Policies Module
- [ ] GET /hr/policies
- [ ] POST /hr/policies
- [ ] GET /hr/policies/:id
- [ ] PATCH /hr/policies/:id
- [ ] DELETE /hr/policies/:id
- [ ] GET /hr/policies/my
- [ ] POST /hr/policies/:id/acknowledge

#### Benefits Module
- [ ] GET /hr/benefits/master
- [ ] POST /hr/benefits/master
- [ ] GET /hr/benefits/policies
- [ ] POST /hr/benefits/policies
- [ ] PATCH /hr/benefits/policies/:id
- [ ] DELETE /hr/benefits/policies/:id
- [ ] GET /hr/benefits/my
- [ ] GET /hr/benefits/eligible
- [ ] GET /hr/benefits/calculate/:policyId

#### Enrollments Module (After Implementation)
- [ ] POST /hr/enrollments
- [ ] GET /hr/enrollments/my
- [ ] GET /hr/enrollments/all
- [ ] PATCH /hr/enrollments/:id
- [ ] DELETE /hr/enrollments/:id
- [ ] PATCH /hr/enrollments/:id/approve
- [ ] POST /hr/enrollments/bulk

#### Claims Module (After Implementation)
- [ ] POST /hr/claims
- [ ] GET /hr/claims/my
- [ ] GET /hr/claims/pending
- [ ] GET /hr/claims/:id
- [ ] PATCH /hr/claims/:id/review
- [ ] PATCH /hr/claims/:id/approve
- [ ] PATCH /hr/claims/:id/reject
- [ ] PATCH /hr/claims/:id/pay

---

## Implementation Timeline

### Completed ✅
- [x] Module 1: HR Policies (~4 hours)
- [x] Module 2: Benefits (~3 hours)

### To Be Completed
- [ ] Module 3: Enrollments (~5 hours)
  - Create 4 DTOs (~30 min)
  - Create service (~2.5 hours)
  - Create controller (~1.5 hours)
  - Test endpoints (~30 min)

- [ ] Module 4: Claims (~5 hours)
  - Create 5 DTOs (~40 min)
  - Create service (~2.5 hours)
  - Create controller (~1.5 hours)
  - Test endpoints (~30 min)

- [ ] Module Registration (~30 min)
  - Update hr.module.ts
  - Build and verify

### Total Remaining: ~10.5 hours

---

## Quick Start Guide

1. **Copy Template Files**:
   - Copy all DTO files to their respective directories
   - Copy service files
   - Copy controller files

2. **Update HrModule**:
   - Add all imports
   - Register entities, controllers, providers

3. **Build & Test**:
   ```bash
   npm run build
   npm run start:dev
   ```

4. **Verify in Swagger**:
   - http://localhost:3000/api
   - Test each endpoint group

5. **Fix Any Issues**:
   - Check entity relationships
   - Verify imports
   - Test with real data

---

**Last Updated**: 2026-01-13
**Document Version**: 1.0
**Status**: Templates Ready for Implementation
