import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateVendorPaymentDto {
    @ApiProperty({ description: 'vendor id', example: 1 })
    @IsNumber()
    @IsPositive()
    readonly vendorid: number;

    @ApiProperty({ description: 'invoice id', example: 1 })
    @IsNumber()
    @IsPositive()
    readonly invoiceid: number;

    @ApiProperty({ description: 'payment date', example: '2026-07-01' })
    @IsDateString()
    readonly paydate: string;

    @ApiProperty({ description: 'amount', example: 1000 })
    @IsNumber()
    @IsPositive()
    readonly amount: number;

    @ApiProperty({ description: 'payment mode', example: 'Transfer' })
    @IsString()
    @MaxLength(50)
    readonly paymode: string;

    @ApiProperty({ description: 'transaction reference', example: 'UTR123' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly transref: string;

    @ApiProperty({ description: 'communication status', example: 'Not Sent' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly communicationstatus: string;

    @ApiProperty({ description: 'communication channel', example: 'WhatsApp' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly communicationchannel: string;

    @ApiProperty({ description: 'communicated at', example: '2026-07-01T12:00:00.000Z' })
    @IsOptional()
    @IsString()
    readonly communicatedat: string;

    @ApiProperty({ description: 'acknowledged at', example: '2026-07-01T13:00:00.000Z' })
    @IsOptional()
    @IsString()
    readonly acknowledgedat: string;

    @ApiProperty({ description: 'acknowledgement reference', example: 'INV-123 confirmed' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly acknowledgementreference: string;

    @ApiProperty({ description: 'remarks', example: 'Paid via bank transfer' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly remarks: string;
}
