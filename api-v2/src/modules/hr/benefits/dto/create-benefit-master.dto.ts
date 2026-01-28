import { IsString, IsEnum, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BenefitCategory, CalculationBasis } from '../../../../entities/enums/hr-policy-benefits.enums';

export class CreateBenefitMasterDto {
  @ApiProperty({ example: 'MEDICAL_INS', description: 'Unique benefit code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  benefitCode: string;

  @ApiProperty({ example: 'Medical Insurance', description: 'Benefit name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  benefitName: string;

  @ApiProperty({ enum: BenefitCategory, example: BenefitCategory.INSURANCE })
  @IsEnum(BenefitCategory)
  @IsNotEmpty()
  benefitCategory: BenefitCategory;

  @ApiPropertyOptional({ example: 'Group health insurance coverage' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional({ enum: CalculationBasis, example: CalculationBasis.FIXED })
  @IsOptional()
  @IsEnum(CalculationBasis)
  calculationBasis?: CalculationBasis;
}
