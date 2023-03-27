import { ApiProperty } from '@nestjs/swagger';

export class CreateProductPriceDto {

    @ApiProperty({ description: 'itemid', example: '' })
    readonly itemid: number;

    @ApiProperty({ description: 'effdate', example: '' })
    readonly effdate: string;
    
    @ApiProperty({ description: 'price', example: '' })
    readonly price: number;

    @ApiProperty({ description: 'oldprice', example: '' })
    readonly oldprice: number;
  
    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;
}