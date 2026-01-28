import { IsString, IsNumber, IsNotEmpty, IsOptional, IsBoolean, IsDateString, IsObject, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBenefitPolicyDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  benefitId: number;

  @ApiProperty({ example: 'Basic Medical Plan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  policyName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 300000 })
  @IsOptional()
  @IsNumber()
  coverageAmount?: number;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsNumber()
  coveragePercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  coverageFormula?: Record<string, any>;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  employeeContributionAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  employeeContributionPercentage?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber()
  employerContributionAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  employerContributionPercentage?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  familyCoverageAllowed?: boolean;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  maxDependents?: number;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @IsNumber()
  dependentCoverageAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  policyProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  policyNumber?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  policyStartDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  policyEndDate?: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsNumber()
  waitingPeriodDays?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  claimSubmissionDeadlineDays?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  maxClaimsPerYear?: number;

  @ApiPropertyOptional({ example: ['invoice', 'prescription'] })
  @IsOptional()
  @IsArray()
  documentsRequired?: string[];

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateBenefitPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  policyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  coverageAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
