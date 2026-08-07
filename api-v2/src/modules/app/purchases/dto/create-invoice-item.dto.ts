import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreatePurchaseInvoiceItemDto {

    @ApiProperty({ description: 'invoice id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly invoiceid: number;

    @ApiProperty({ description: 'product id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly productid: number;

    @ApiProperty({ description: 'batch', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly batch: string;

    @ApiProperty({ description: 'exp date', example: '' })
    @IsOptional()
    @IsString()
    readonly expdate: string;

    @ApiProperty({ description: 'mfr date', example: '' })
    @IsOptional()
    @IsString()
    readonly mfrdate: string;

    @ApiProperty({ description: 'ptr value', example: 0 })
    @IsNumber()
    @Min(0)
    readonly ptrvalue: number;

    @ApiProperty({ description: 'ptr cost', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly ptrcost: number;

    @ApiProperty({ description: 'mrp cost', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly mrpcost: number;

    @ApiProperty({ description: 'disc percent', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly discpcnt: number;

    @ApiProperty({ description: 'tax percent', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly taxpcnt: number;

    @ApiProperty({ description: 'sale price', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly saleprice: number;

    @ApiProperty({ description: 'quantity', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly qty: number;

    @ApiProperty({ description: 'free quantity', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly freeqty: number;

    @ApiProperty({ description: 'request id', example: 0, required: false })
    @IsOptional()
    @IsNumber()
    readonly requestid: number;

    @ApiProperty({ description: 'total', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly total: number;

    @ApiProperty({ description: 'comments', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly comments: string;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;
}
