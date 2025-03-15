import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleReturnItemDto {

    @ApiProperty({ description: 'id', example: 0 })
    readonly id: number;

    @ApiProperty({ description: 'sale item id', example: 0 })
    readonly saleitemid: number;
  
    @ApiProperty({ description: 'quantity', example: 0 })
    readonly qty: number;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;

    @ApiProperty({ description: 'reason', example: '' })
    readonly reason: string;

    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;
}