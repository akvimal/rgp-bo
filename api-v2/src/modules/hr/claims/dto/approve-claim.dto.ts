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
