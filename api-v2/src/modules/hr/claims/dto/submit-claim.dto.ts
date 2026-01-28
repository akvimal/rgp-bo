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
