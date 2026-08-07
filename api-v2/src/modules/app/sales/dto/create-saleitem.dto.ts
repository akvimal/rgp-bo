import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateSaleItemDto {

    @ApiProperty({ description: 'sale id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly saleid: number;

    @ApiProperty({ description: 'purchase item id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly itemid: number;

    @ApiProperty({ description: 'price', example: 0 })
    @IsNumber()
    @Min(0)
    readonly price: number;

    @ApiProperty({ description: 'mrp', example: 0 })
    @IsNumber()
    @Min(0)
    readonly mrpcost: number;

    @ApiProperty({ description: 'tax', example: 0 })
    @IsNumber()
    @Min(0)
    readonly taxpcnt: number;

    @ApiProperty({ description: 'quantity', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly qty: number;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;
}
