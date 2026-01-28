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
