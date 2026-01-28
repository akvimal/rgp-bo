import { IsString, IsEnum, IsNotEmpty, IsOptional, IsBoolean, IsDateString, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PolicyCategory } from '../../../../entities/enums/hr-policy-benefits.enums';

export class CreateHrPolicyDto {
  @ApiProperty({ example: 'PROBATION', description: 'Unique policy code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  policyCode: string;

  @ApiProperty({ example: 'Probation Period Policy', description: 'Policy name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  policyName: string;

  @ApiProperty({ enum: PolicyCategory, example: PolicyCategory.EMPLOYMENT })
  @IsEnum(PolicyCategory)
  @IsNotEmpty()
  policyCategory: PolicyCategory;

  @ApiPropertyOptional({ example: 'Standard probation period policy for new employees' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: {
      duration_months: 3,
      extension_allowed: true,
      max_extensions: 1,
    },
    description: 'JSON configuration for policy rules',
  })
  @IsObject()
  @IsNotEmpty()
  policyContent: Record<string, any>;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiProperty({ example: '2026-01-01', description: 'Effective from date (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Effective to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
