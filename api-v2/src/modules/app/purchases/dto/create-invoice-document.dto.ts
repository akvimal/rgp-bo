import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';
import { InvoiceDocumentType, OcrStatus, AutoPopulateStatus } from '../enums';

export class CreateInvoiceDocumentDto {

    @ApiPropertyOptional({ description: 'Invoice ID (can be null for unlinked documents)', example: 1 })
    @IsOptional()
    @IsNumber()
    readonly invoiceid?: number;

    @ApiProperty({ description: 'Document ID (from documents table)', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    readonly documentid: number;

    @ApiProperty({
        description: 'Document type',
        enum: InvoiceDocumentType,
        example: InvoiceDocumentType.INVOICE_SCAN
    })
    @IsNotEmpty()
    @IsEnum(InvoiceDocumentType)
    readonly doctype: InvoiceDocumentType;

    @ApiPropertyOptional({ description: 'Upload source (WEB_UPLOAD, MOBILE_SCAN, EMAIL, API)', example: 'WEB_UPLOAD' })
    @IsOptional()
    @IsString()
    readonly uploadsource?: string;

    @ApiPropertyOptional({ description: 'Original filename', example: 'invoice_scan_001.pdf' })
    @IsOptional()
    @IsString()
    readonly originalfilename?: string;
}

export class UpdateOcrStatusDto {

    @ApiProperty({
        description: 'OCR status',
        enum: OcrStatus,
        example: OcrStatus.COMPLETED
    })
    @IsNotEmpty()
    @IsEnum(OcrStatus)
    readonly ocrstatus: OcrStatus;

    @ApiPropertyOptional({ description: 'OCR confidence score (0-100)', example: 92.5 })
    @IsOptional()
    @IsNumber()
    readonly ocrconfidencescore?: number;

    @ApiPropertyOptional({ description: 'OCR extracted data (JSON)' })
    @IsOptional()
    readonly ocrextracteddata?: object;

    @ApiPropertyOptional({ description: 'OCR error message' })
    @IsOptional()
    @IsString()
    readonly ocrerrormessage?: string;
}

export class UpdateAutoPopulateDto {

    @ApiProperty({ description: 'Auto-populated flag', example: true })
    @IsNotEmpty()
    @IsBoolean()
    readonly autopopulated: boolean;

    @ApiPropertyOptional({
        description: 'Auto-populate status',
        enum: AutoPopulateStatus,
        example: AutoPopulateStatus.COMPLETE
    })
    @IsOptional()
    @IsEnum(AutoPopulateStatus)
    readonly autopopulatestatus?: AutoPopulateStatus;

    @ApiPropertyOptional({ description: 'Field mapping (JSON)' })
    @IsOptional()
    readonly fieldmapping?: object;
}

export class MarkForReviewDto {

    @ApiProperty({ description: 'Requires review flag', example: true })
    @IsNotEmpty()
    @IsBoolean()
    readonly requiresreview: boolean;

    @ApiPropertyOptional({ description: 'Review notes' })
    @IsOptional()
    @IsString()
    readonly reviewnotes?: string;
}
