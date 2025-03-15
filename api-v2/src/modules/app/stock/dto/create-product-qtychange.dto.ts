import { ApiProperty } from '@nestjs/swagger';

export class CreateProductQtyChangeDto {

    @ApiProperty({ description: 'itemid', example: 0 })
    readonly itemid: number;
    
    @ApiProperty({ description: 'qty', example: 0 })
    readonly qty: number;
    @ApiProperty({ description: 'price', example: 0 })
    readonly price?: number;
  
    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;
    @ApiProperty({ description: 'reason', example: '' })
    readonly reason: string;
    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;
}