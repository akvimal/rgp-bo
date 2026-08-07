import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateSaleReturnItemDto {

    @ApiProperty({ description: 'id', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly id: number;

    @ApiProperty({ description: 'sale item id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly saleitemid: number;

    @ApiProperty({ description: 'quantity', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly qty: number;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;

    @ApiProperty({ description: 'reason', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly reason: string;

    @ApiProperty({ description: 'comments', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly comments: string;
}
