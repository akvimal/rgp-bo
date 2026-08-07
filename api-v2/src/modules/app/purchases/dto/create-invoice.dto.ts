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

}
