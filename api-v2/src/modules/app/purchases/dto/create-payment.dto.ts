import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean, Min } from 'class-validator';
import { PaymentType, PaymentAgainst, SinglePaymentStatus } from '../enums';

export class CreateVendorPaymentDto {

    @ApiProperty({ description: 'Vendor ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    readonly vendorid: number;

    @ApiProperty({ description: 'Invoice ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    readonly invoiceid: number;

    @ApiProperty({ description: 'Payment date (YYYY-MM-DD)', example: '2024-12-05' })
    @IsNotEmpty()
    @IsString()
    readonly paydate: string;

    @ApiProperty({ description: 'Payment amount', example: 25000.00 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    readonly amount: number;

    @ApiPropertyOptional({
        description: 'Payment type',
        enum: PaymentType,
        default: PaymentType.FULL,
        example: PaymentType.FULL
    })
    @IsOptional()
    @IsEnum(PaymentType)
    readonly paymenttype?: PaymentType;

    @ApiPropertyOptional({
        description: 'Payment against',
        enum: PaymentAgainst,
        default: PaymentAgainst.INVOICE,
        example: PaymentAgainst.INVOICE
    })
    @IsOptional()
    @IsEnum(PaymentAgainst)
    readonly paymentagainst?: PaymentAgainst;

    @ApiPropertyOptional({
        description: 'Payment status',
        enum: SinglePaymentStatus,
        default: SinglePaymentStatus.COMPLETED,
        example: SinglePaymentStatus.COMPLETED
    })
    @IsOptional()
    @IsEnum(SinglePaymentStatus)
    readonly paymentstatus?: SinglePaymentStatus;

    @ApiPropertyOptional({ description: 'Payment mode (CASH, CHEQUE, NEFT, UPI)', example: 'NEFT' })
    @IsOptional()
    @IsString()
    readonly paymode?: string;

    @ApiPropertyOptional({ description: 'Transaction reference', example: 'TXN123456' })
    @IsOptional()
    @IsString()
    readonly transref?: string;

    @ApiPropertyOptional({ description: 'Bank name', example: 'HDFC Bank' })
    @IsOptional()
    @IsString()
    readonly bankname?: string;

    @ApiPropertyOptional({ description: 'Cheque number', example: '123456' })
    @IsOptional()
    @IsString()
    readonly chequeno?: string;

    @ApiPropertyOptional({ description: 'UTR number (for NEFT/RTGS/UPI)', example: 'UTR123456789' })
    @IsOptional()
    @IsString()
    readonly utrno?: string;

    @ApiPropertyOptional({ description: 'Payment proof document ID', example: 1 })
    @IsOptional()
    @IsNumber()
    readonly paymentproofdocid?: number;

    @ApiPropertyOptional({ description: 'Notes/Comments' })
    @IsOptional()
    @IsString()
    readonly notes?: string;
}

export class ReconcilePaymentDto {

    @ApiProperty({ description: 'Reconciliation status', example: true })
    @IsNotEmpty()
    @IsBoolean()
    readonly reconciled: boolean;

    @ApiPropertyOptional({ description: 'Reconciliation notes' })
    @IsOptional()
    @IsString()
    readonly notes?: string;
}
