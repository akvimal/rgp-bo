import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreatePurchaseInvoiceDto {

    @ApiProperty({ description: 'ID', example: '' })
    @IsOptional()
    @IsNumber()
    readonly id: number;

    @ApiProperty({ description: 'invoice no', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly invoiceno: string;

    @ApiProperty({ description: 'invoice date', example: '' })
    @IsOptional()
    @IsDateString()
    readonly invoicedate: string;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;

    @ApiProperty({ description: 'grno', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly grno: string;

    @ApiProperty({ description: 'due date', example: '' })
    @IsOptional()
    @IsDateString()
    readonly duedate: string;

    @ApiProperty({ description: 'payment status', example: 'Unpaid' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly paymentstatus: string;

    @ApiProperty({ description: 'reference no', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly referenceno: string;

    @ApiProperty({ description: 'total', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly total: number;

    @ApiProperty({ description: 'notes', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly notes: string;

    @ApiProperty({ description: 'vendor id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly vendorid: number;

    @ApiProperty({ description: 'purchase order id', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly purchaseorderid: string;

    @ApiProperty({ description: 'items', example: [] })
    @IsOptional()
    @IsArray()
    readonly items: [];

    @ApiProperty({ description: 'supplier GSTIN (defaults to the vendor\'s GSTIN)', example: '', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(15)
    readonly suppliergstin: string;

    @ApiProperty({ description: 'place of supply (state code, defaults from the supplier GSTIN)', example: '', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2)
    readonly placeofsupply: string;

    @ApiProperty({ description: 'INTRA or INTER (defaults from place of supply vs the business\'s own state)', example: 'INTRA', required: false })
    @IsOptional()
    @IsString()
    readonly supplytype: string;

    @ApiProperty({ description: 'REGULAR / SEZ / IMPORT / DEEMED_EXPORT', example: 'REGULAR', required: false })
    @IsOptional()
    @IsString()
    readonly invoicetype: string;

    @ApiProperty({ description: 'reverse charge applicable', example: false, required: false })
    @IsOptional()
    readonly reversecharge: boolean;

    @ApiProperty({ description: 'INPUTS / CAPITAL_GOODS / INELIGIBLE', example: 'INPUTS', required: false })
    @IsOptional()
    @IsString()
    readonly itceligibility: string;

}
