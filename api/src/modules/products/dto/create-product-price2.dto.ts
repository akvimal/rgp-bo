import { ApiProperty } from '@nestjs/swagger';

export class CreateProductPrice2Dto {

    @ApiProperty({ description: 'productid', example: '' })
    readonly productid: number;

    @ApiProperty({ description: 'effdate', example: '' })
    readonly effdate: string;
    
    @ApiProperty({ description: 'sale price', example: '' })
    readonly saleprice: number;
    @ApiProperty({ description: 'reason', example: '' })
    readonly reason:string;
    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;
 
}