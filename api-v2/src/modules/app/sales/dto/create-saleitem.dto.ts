import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleItemDto {

    @ApiProperty({ description: 'sale id', example: 0 })
    readonly saleid: number;
    
    @ApiProperty({ description: 'purchase item id', example: 0 })
    readonly itemid: number;
  
    @ApiProperty({ description: 'price', example: 0 })
    readonly price: number; 
    @ApiProperty({ description: 'mrp', example: 0 })
    readonly mrpcost: number;  
    @ApiProperty({ description: 'tax', example: 0 })
    readonly taxpcnt: number;
  
    @ApiProperty({ description: 'quantity', example: 0 })
    readonly qty: number;
    // @ApiProperty({ description: 'pack', example: 0 })
    // readonly pack: number;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;
}