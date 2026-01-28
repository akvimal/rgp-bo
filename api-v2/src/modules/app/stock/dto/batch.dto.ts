import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for batch recall request
 */
export class RecallBatchDto {
  @ApiProperty({
    description: 'Reason for recalling the batch (quality issue, safety concern, etc.)',
    example: 'Quality control failure - contamination detected'
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the recall',
    example: 'Batch recalled per QA directive #123. All stock quarantined.'
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * DTO for batch query parameters
 */
export class BatchQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by batch status (ACTIVE, EXPIRED, DEPLETED, RECALLED)',
    example: 'ACTIVE'
  })
  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'EXPIRED' | 'DEPLETED' | 'RECALLED';

  @ApiPropertyOptional({
    description: 'Filter by product ID',
    example: 123
  })
  @IsNumber()
  @IsOptional()
  productId?: number;

  @ApiPropertyOptional({
    description: 'Filter by vendor ID',
    example: 45
  })
  @IsNumber()
  @IsOptional()
  vendorId?: number;

  @ApiPropertyOptional({
    description: 'Filter batches expiring within days',
    example: 30,
    minimum: 1,
    maximum: 365
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(365)
  expiringWithinDays?: number;
}

/**
 * DTO for near-expiry threshold validation
 */
export class NearExpiryThresholdDto {
  @ApiProperty({
    description: 'Number of days threshold for near-expiry check',
    example: 30,
    minimum: 1,
    maximum: 365
  })
  @IsNumber()
  @Min(1)
  @Max(365)
  threshold: number;
}
