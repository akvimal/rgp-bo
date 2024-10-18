import { ApiProperty } from '@nestjs/swagger';

export class CreateProductPrice2Dto {

    @ApiProperty({ description: 'productid', example: '' })
    readonly productid: number;

    @ApiProperty({ description: 'effdate', example: '' })
    readonly effdate: string;
    
    @ApiProperty({ description: 'price', example: '' })
    readonly price: number;
 
}