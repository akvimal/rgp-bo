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

    @ApiProperty({ description: 'how the customer is refunded: CREDIT, CASH or TRANSFER', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    readonly refundmode?: string;

    @ApiProperty({ description: 'quantity accepted back into stock (settling a return)', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly acceptedqty?: number;

    @ApiProperty({ description: 'comments', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly comments: string;
}
