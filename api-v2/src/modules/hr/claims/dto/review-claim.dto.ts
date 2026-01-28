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
