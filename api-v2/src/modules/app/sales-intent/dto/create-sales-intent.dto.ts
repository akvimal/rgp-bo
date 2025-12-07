import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { IntentType, Priority } from 'src/entities/sales-intent.entity';
import { SalesIntentItemDto } from './sales-intent-item.dto';

export class CreateSalesIntentDto {
    @ApiProperty({ enum: IntentType, description: 'Type of intent' })
    @IsEnum(IntentType)
    @IsNotEmpty()
    intenttype: IntentType;

    @ApiProperty({ enum: Priority, description: 'Priority level', default: 'MEDIUM' })
    @IsEnum(Priority)
    @IsOptional()
    priority?: Priority;

    // === NEW: Multiple Products Support ===
    @ApiPropertyOptional({
        description: 'Array of product items (NEW: supports multiple products)',
        type: [SalesIntentItemDto],
        required: false
    })
    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMinSize(1)
    @Type(() => SalesIntentItemDto)
    @IsOptional()
    items?: SalesIntentItemDto[];

    // === DEPRECATED: Single Product Fields (kept for backward compatibility) ===
    @ApiPropertyOptional({ description: 'Product ID (DEPRECATED: use items array instead)' })
    @IsNumber()
    @IsOptional()
    prodid?: number;

    @ApiPropertyOptional({ description: 'Product name (DEPRECATED: use items array instead)', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    productname?: string;

    @ApiPropertyOptional({ description: 'Requested quantity (DEPRECATED: use items array instead)', minimum: 1 })
    @IsNumber()
    @IsOptional()
    @Min(1)
    requestedqty?: number;

    @ApiPropertyOptional({ description: 'Customer ID (for customer requests)' })
    @IsNumber()
    @IsOptional()
    customerid?: number;

    @ApiPropertyOptional({ description: 'Customer name', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    customername?: string;

    @ApiPropertyOptional({ description: 'Customer mobile', maxLength: 15 })
    @IsString()
    @IsOptional()
    @MaxLength(15)
    customermobile?: string;

    @ApiPropertyOptional({ description: 'Advance amount paid by customer', default: 0 })
    @IsNumber()
    @IsOptional()
    @Min(0)
    advanceamount?: number;

    @ApiPropertyOptional({ description: 'Estimated cost' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    estimatedcost?: number;

    @ApiPropertyOptional({ description: 'Request notes (why this product is needed)' })
    @IsString()
    @IsOptional()
    requestnotes?: string;

    @ApiPropertyOptional({ description: 'Internal notes for purchase staff' })
    @IsString()
    @IsOptional()
    internalnotes?: string;
}
