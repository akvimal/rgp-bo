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
