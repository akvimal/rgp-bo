import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class SalesIntentItemDto {
    @ApiPropertyOptional({ description: 'Item ID (for updates, omit for new items)' })
    @IsNumber()
    @IsOptional()
    id?: number;

    @ApiPropertyOptional({ description: 'Product ID (null for new products not in system)' })
    @IsNumber()
    @IsOptional()
    prodid?: number;

    @ApiProperty({ description: 'Product name', maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    productname: string;

    @ApiProperty({ description: 'Requested quantity', minimum: 1 })
    @IsNumber()
    @Min(1)
    requestedqty: number;

    @ApiPropertyOptional({ description: 'Estimated cost per unit' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    estimatedcost?: number;

    @ApiPropertyOptional({ description: 'Notes specific to this item' })
    @IsString()
    @IsOptional()
    itemnotes?: string;
}
