import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreatePurchaseOrderDto {

    @ApiProperty({ description: 'ID', example: '' })
    @IsOptional()
    @IsNumber()
    readonly id: number;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;

    @ApiProperty({ description: 'comments', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly comments: string;

    @ApiProperty({ description: 'po number', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly ponumber: string;

    @ApiProperty({ description: 'expected date', example: '2026-07-05' })
    @IsOptional()
    @IsDateString()
    readonly expecteddate: string;

    @ApiProperty({ description: 'source summary', example: 'Trend + Customer Request' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly sourcesummary: string;

    @ApiProperty({ description: 'approval status', example: 'Pending' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly approvalstatus: string;

    @ApiProperty({ description: 'approval reason', example: 'PO value exceeds threshold' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly approvalreason: string;

    @ApiProperty({ description: 'rejection reason', example: 'Need price review' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly rejectionreason: string;

    @ApiProperty({ description: 'vendor id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly vendorid: number;

}
