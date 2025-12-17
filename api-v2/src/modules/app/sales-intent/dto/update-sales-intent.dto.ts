import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { IntentType, Priority, IntentStatus, FulfillmentStatus } from 'src/entities/sales-intent.entity';
import { SalesIntentItemDto } from './sales-intent-item.dto';

export class UpdateSalesIntentDto {
    @ApiPropertyOptional({
        description: 'Array of product items (supports multiple products)',
        type: [SalesIntentItemDto],
        required: false
    })
    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMinSize(1)
    @Type(() => SalesIntentItemDto)
    @IsOptional()
    items?: SalesIntentItemDto[];
    @ApiPropertyOptional({ enum: IntentType })
    @IsEnum(IntentType)
    @IsOptional()
    intenttype?: IntentType;

    @ApiPropertyOptional({ enum: Priority })
    @IsEnum(Priority)
    @IsOptional()
    priority?: Priority;

    @ApiPropertyOptional({ description: 'Product ID' })
    @IsNumber()
    @IsOptional()
    prodid?: number;

    @ApiPropertyOptional({ description: 'Product name', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    productname?: string;

    @ApiPropertyOptional({ description: 'Requested quantity', minimum: 1 })
    @IsNumber()
    @Min(1)
    @IsOptional()
    requestedqty?: number;

    @ApiPropertyOptional({ description: 'Customer ID' })
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

    @ApiPropertyOptional({ description: 'Advance amount' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    advanceamount?: number;

    @ApiPropertyOptional({ description: 'Estimated cost' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    estimatedcost?: number;

    @ApiPropertyOptional({ enum: IntentStatus })
    @IsEnum(IntentStatus)
    @IsOptional()
    status?: IntentStatus;

    @ApiPropertyOptional({ enum: FulfillmentStatus })
    @IsEnum(FulfillmentStatus)
    @IsOptional()
    fulfillmentstatus?: FulfillmentStatus;

    @ApiPropertyOptional({ description: 'Request notes' })
    @IsString()
    @IsOptional()
    requestnotes?: string;

    @ApiPropertyOptional({ description: 'Internal notes' })
    @IsString()
    @IsOptional()
    internalnotes?: string;

    @ApiPropertyOptional({ description: 'Purchase Order ID' })
    @IsNumber()
    @IsOptional()
    purchaseorderid?: number;
}

export class UpdateFulfillmentDto {
    @ApiPropertyOptional({ enum: FulfillmentStatus })
    @IsEnum(FulfillmentStatus)
    @IsOptional()
    fulfillmentstatus?: FulfillmentStatus;

    @ApiPropertyOptional({ description: 'Purchase Order ID when linking to PO' })
    @IsNumber()
    @IsOptional()
    purchaseorderid?: number;

    @ApiPropertyOptional({ description: 'Internal notes' })
    @IsString()
    @IsOptional()
    internalnotes?: string;
}
