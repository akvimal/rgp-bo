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
