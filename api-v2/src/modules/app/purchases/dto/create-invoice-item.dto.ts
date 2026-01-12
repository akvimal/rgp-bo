import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { ItemType } from '../enums';

export class CreatePurchaseInvoiceItemDto {

    @ApiProperty({ description: 'Invoice ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    readonly invoiceid: number;

    @ApiProperty({ description: 'Product ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    readonly productid: number;

    @ApiPropertyOptional({
        description: 'Item type',
        enum: ItemType,
        default: ItemType.REGULAR,
        example: ItemType.REGULAR
    })
    @IsOptional()
    @IsEnum(ItemType)
    readonly itemtype?: ItemType;

    @ApiProperty({ description: 'Batch number', example: 'BATCH001' })
    @IsNotEmpty()
    @IsString()
    readonly batch: string;

    @ApiPropertyOptional({ description: 'Expiry date (YYYY-MM-DD)', example: '2025-12-31' })
    @IsOptional()
    @IsString()
    readonly expdate?: string;

    @ApiPropertyOptional({ description: 'Manufacturing date (YYYY-MM-DD)', example: '2024-01-01' })
    @IsOptional()
    @IsString()
    readonly mfrdate?: string;

    @ApiProperty({ description: 'PTR value (rate per unit)', example: 25.00 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    readonly ptrvalue: number;

    @ApiProperty({ description: 'PTR cost (total before discount)', example: 2500.00 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    readonly ptrcost: number;

    @ApiProperty({ description: 'MRP cost per unit', example: 30.00 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    readonly mrpcost: number;

    @ApiPropertyOptional({ description: 'Discount percentage', example: 10.5, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly discpcnt?: number;

    @ApiPropertyOptional({ description: 'Tax percentage (total GST)', example: 12, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly taxpcnt?: number;

    // Tax Breakdown (optional, can be calculated)
    @ApiPropertyOptional({ description: 'CGST percentage', example: 6 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly cgstpcnt?: number;

    @ApiPropertyOptional({ description: 'SGST percentage', example: 6 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly sgstpcnt?: number;

    @ApiPropertyOptional({ description: 'IGST percentage', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly igstpcnt?: number;

    @ApiPropertyOptional({ description: 'CGST amount', example: 135.00 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly cgstamount?: number;

    @ApiPropertyOptional({ description: 'SGST amount', example: 135.00 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly sgstamount?: number;

    @ApiPropertyOptional({ description: 'IGST amount', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly igstamount?: number;

    @ApiPropertyOptional({ description: 'Sale price (calculated)', example: 28.00 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly saleprice?: number;

    @ApiProperty({ description: 'Quantity', example: 100 })
    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    readonly qty: number;

    @ApiPropertyOptional({ description: 'Free quantity', example: 10, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly freeqty?: number;

    @ApiProperty({ description: 'Total line amount', example: 2520.00 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    readonly total: number;

    @ApiPropertyOptional({ description: 'Comments/Notes' })
    @IsOptional()
    @IsString()
    readonly comments?: string;

    // Item Type Specific Fields
    @ApiPropertyOptional({
        description: 'Delivery challan reference (required for SUPPLIED items)',
        example: 'DC-2024-001'
    })
    @ValidateIf(o => o.itemtype === ItemType.SUPPLIED)
    @IsNotEmpty({ message: 'Challan reference is required for SUPPLIED items' })
    @IsString()
    readonly challanref?: string;

    @ApiPropertyOptional({
        description: 'Return reason (required for RETURN items)',
        example: 'Damaged during transit'
    })
    @ValidateIf(o => o.itemtype === ItemType.RETURN)
    @IsNotEmpty({ message: 'Return reason is required for RETURN items' })
    @IsString()
    readonly returnreason?: string;
}