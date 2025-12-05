import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DocType } from '../enums';

export class CreatePurchaseInvoiceDto {

    @ApiPropertyOptional({ description: 'ID (auto-generated if not provided)' })
    @IsOptional()
    @IsNumber()
    readonly id?: number;

    @ApiProperty({ description: 'Invoice number', example: 'INV-2024-001' })
    @IsNotEmpty()
    @IsString()
    readonly invoiceno: string;

    @ApiProperty({ description: 'Invoice date (YYYY-MM-DD)', example: '2024-12-05' })
    @IsNotEmpty()
    @IsString()
    readonly invoicedate: string;

    @ApiProperty({ description: 'Vendor ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    readonly vendorid: number;

    @ApiPropertyOptional({
        description: 'Document type',
        enum: DocType,
        default: DocType.INVOICE,
        example: DocType.INVOICE
    })
    @IsOptional()
    @IsEnum(DocType)
    readonly doctype?: DocType;

    @ApiPropertyOptional({ description: 'GR (Goods Receipt) Number', example: 'GRN-2024-001' })
    @IsOptional()
    @IsString()
    readonly grno?: string;

    @ApiPropertyOptional({ description: 'GR Date (YYYY-MM-DD)', example: '2024-12-05' })
    @IsOptional()
    @IsString()
    readonly grdate?: string;

    @ApiPropertyOptional({ description: 'Purchase order reference', example: 'PO-2024-001' })
    @IsOptional()
    @IsString()
    readonly purchaseorderid?: string;

    @ApiPropertyOptional({ description: 'Comments/Notes', example: 'Urgent delivery' })
    @IsOptional()
    @IsString()
    readonly comments?: string;

    @ApiPropertyOptional({ description: 'Total invoice amount', example: 25000.00 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly total?: number;

    // Tax amounts (optional, can be calculated from items)
    @ApiPropertyOptional({ description: 'Total taxable amount', example: 20000.00 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly taxamount?: number;

    @ApiPropertyOptional({ description: 'CGST amount', example: 1800.00 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly cgstamount?: number;

    @ApiPropertyOptional({ description: 'SGST amount', example: 1800.00 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly sgstamount?: number;

    @ApiPropertyOptional({ description: 'IGST amount', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly igstamount?: number;

    @ApiPropertyOptional({ description: 'Invoice items (can be added separately)' })
    @IsOptional()
    readonly items?: any[];
}