import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean, Min, Length } from 'class-validator';
import { TaxFilingStatus } from '../enums';

export class CreateTaxCreditDto {

    @ApiProperty({ description: 'Invoice ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    readonly invoiceid: number;

    @ApiProperty({ description: 'GST Filing Month (YYYY-MM-01)', example: '2024-12-01' })
    @IsNotEmpty()
    @IsString()
    readonly gstfilingmonth: string;

    @ApiProperty({ description: 'Vendor GSTIN (15 characters)', example: '27AAAAA0000A1Z5' })
    @IsNotEmpty()
    @IsString()
    @Length(15, 15, { message: 'GSTIN must be exactly 15 characters' })
    readonly vendorgstin: string;

    @ApiProperty({ description: 'Taxable amount', example: 20000.00 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    readonly taxableamount: number;

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

    @ApiProperty({ description: 'Total tax credit', example: 3600.00 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    readonly totaltaxcredit: number;

    @ApiPropertyOptional({
        description: 'Filing status',
        enum: TaxFilingStatus,
        default: TaxFilingStatus.PENDING,
        example: TaxFilingStatus.PENDING
    })
    @IsOptional()
    @IsEnum(TaxFilingStatus)
    readonly filingstatus?: TaxFilingStatus;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsOptional()
    @IsString()
    readonly notes?: string;
}

export class UpdateTaxCreditDto {

    @ApiPropertyOptional({
        description: 'Filing status',
        enum: TaxFilingStatus,
        example: TaxFilingStatus.FILED_BY_VENDOR
    })
    @IsOptional()
    @IsEnum(TaxFilingStatus)
    readonly filingstatus?: TaxFilingStatus;

    @ApiPropertyOptional({ description: 'Date when vendor filed (YYYY-MM-DD)', example: '2025-01-10' })
    @IsOptional()
    @IsString()
    readonly fileddate?: string;

    @ApiPropertyOptional({ description: 'Date reflected in GSTR-2A (YYYY-MM-DD)', example: '2025-01-12' })
    @IsOptional()
    @IsString()
    readonly reflectedin2adate?: string;

    @ApiPropertyOptional({ description: 'Claimed in return (e.g., GSTR-3B Dec 2024)', example: 'GSTR-3B Dec 2024' })
    @IsOptional()
    @IsString()
    readonly claimedinreturn?: string;

    @ApiPropertyOptional({ description: 'Claimed date (YYYY-MM-DD)', example: '2025-01-20' })
    @IsOptional()
    @IsString()
    readonly claimeddate?: string;

    @ApiPropertyOptional({ description: 'GSTR-1 document ID', example: 1 })
    @IsOptional()
    @IsNumber()
    readonly gstr1docid?: number;

    @ApiPropertyOptional({ description: 'GSTR-2A screenshot document ID', example: 2 })
    @IsOptional()
    @IsNumber()
    readonly gstr2ascreenshotid?: number;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsOptional()
    @IsString()
    readonly notes?: string;
}

export class ReportMismatchDto {

    @ApiProperty({ description: 'Has mismatch', example: true })
    @IsNotEmpty()
    @IsBoolean()
    readonly hasmismatch: boolean;

    @ApiProperty({ description: 'Mismatch reason', example: 'Amount difference in GSTR-2A' })
    @IsNotEmpty()
    @IsString()
    readonly mismatchreason: string;

    @ApiProperty({ description: 'Mismatch amount', example: 500.00 })
    @IsNotEmpty()
    @IsNumber()
    readonly mismatchamount: number;

    @ApiPropertyOptional({ description: 'Mismatch resolved', example: false, default: false })
    @IsOptional()
    @IsBoolean()
    readonly mismatchresolved?: boolean;

    @ApiPropertyOptional({ description: 'Resolution notes' })
    @IsOptional()
    @IsString()
    readonly mismatchresolutionnotes?: string;
}
