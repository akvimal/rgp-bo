import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleItemDto {

    @ApiProperty({ description: 'sale id', example: 0 })
    readonly saleid: number;
    
    @ApiProperty({ description: 'purchase item id', example: 0 })
    readonly itemid: number;
  
    @ApiProperty({ description: 'price', example: 0 })
    readonly price: number;
  
    @ApiProperty({ description: 'quantity', example: 0 })
    readonly qty: number;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;

    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;

}