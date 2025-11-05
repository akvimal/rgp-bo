import { ApiProperty } from '@nestjs/swagger';

export class CreateProductPrice2Dto {

    @ApiProperty({ description: 'productid', example: 1 })
    readonly productid: number;

    @ApiProperty({ description: 'effdate', example: '2024-01-01', required: false })
    readonly effdate?: string;

    @ApiProperty({ description: 'enddate', example: '2099-12-31', required: false })
    readonly enddate?: string;

    @ApiProperty({ description: 'sale price', example: 99.99 })
    readonly saleprice: number;

    @ApiProperty({ description: 'reason', example: 'Purchase', required: false })
    readonly reason?: string;

    @ApiProperty({ description: 'comments', example: '', required: false })
    readonly comments?: string;

}