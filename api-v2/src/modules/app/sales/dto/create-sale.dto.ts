import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsObject, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateSaleDto {

    @ApiProperty({ description: 'id', example: '' })
    @IsOptional()
    @IsNumber()
    readonly id: number;

    @ApiProperty({ description: 'bill date', example: '' })
    @IsOptional()
    @IsDateString()
    readonly billdate: string;

    @ApiProperty({ description: 'order date', example: '' })
    @IsOptional()
    @IsString()
    readonly orderdate: string;

    @ApiProperty({ description: 'bill no', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly billno: number;

    @ApiProperty({ description: 'order no', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly orderno: number;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;

    @ApiProperty({ description: 'ordertype', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly ordertype: string;

    @ApiProperty({ description: 'deliverytype', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly deliverytype: string;

    @ApiProperty({ description: 'Digital Payment Method', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly digimethod: string | null;

    @ApiProperty({ description: 'Digital Payment RefNo', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly digirefno: string | null;

    @ApiProperty({ description: 'Digital Payment Amount', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly digiamt: number;

    @ApiProperty({ description: 'Cash Payment Amount', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly cashamt: number;

    @ApiProperty({ description: 'expreturn days', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly expreturndays: number;

    @ApiProperty({ description: 'document pending', example: false })
    @IsOptional()
    @IsBoolean()
    readonly docpending: boolean;

    @ApiProperty({ description: 'customer id', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly customerid: number;

    @ApiProperty({ description: 'customer', example: {} })
    @IsOptional()
    @IsObject()
    readonly customer: any;

    @ApiProperty({ description: 'acting user id', example: 0, required: false })
    @IsOptional()
    @IsNumber()
    @IsPositive()
    readonly actinguserid?: number;
}
