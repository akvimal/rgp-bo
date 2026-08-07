import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestionOrderItemDto {
    @ApiProperty({ description: 'product id', example: 101 })
    @IsNumber()
    @IsPositive()
    readonly productid: number;

    @ApiProperty({ description: 'vendor id', example: 101 })
    @IsNumber()
    @IsPositive()
    readonly vendorid: number;

    @ApiProperty({ description: 'final quantity', example: 12 })
    @IsNumber()
    @Min(0)
    readonly finalqty: number;

    @ApiProperty({ description: 'trend quantity', example: 8 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly trendqty: number;

    @ApiProperty({ description: 'adhoc quantity', example: 4 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly adhocqty: number;

    @ApiProperty({ description: 'request ids', example: [1, 2] })
    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    readonly requestids: number[];

    @ApiProperty({ description: 'reason summary', example: 'Low Stock, Customer Request' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly reasonsummary: string;
}

export class CreateSuggestionOrderDto {
    @ApiProperty({ description: 'expected date', example: '2026-07-05', required: false })
    @IsOptional()
    @IsDateString()
    readonly expecteddate: string;

    @ApiProperty({ description: 'comments', example: 'Generated from purchase suggestions', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly comments: string;

    @ApiProperty({ description: 'items', type: [SuggestionOrderItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SuggestionOrderItemDto)
    readonly items: SuggestionOrderItemDto[];
}
