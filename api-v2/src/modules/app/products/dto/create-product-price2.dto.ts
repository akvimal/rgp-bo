import { ApiProperty } from '@nestjs/swagger';

export class CreateProductPrice2Dto {

    @ApiProperty({ description: 'productid', example: '' })
    readonly productid: number;

    @ApiProperty({ description: 'effdate', example: '' })
    readonly effdate?: string;

    @ApiProperty({ description: 'sale price', example: '' })
    readonly saleprice: number;

    @ApiProperty({ description: 'base price (PTR)', example: '', required: false })
    readonly baseprice?: number;

    @ApiProperty({ description: 'MRP (Maximum Retail Price)', example: '', required: false })
    readonly mrp?: number;

    @ApiProperty({ description: 'margin percentage (auto-calculated if not provided)', example: '', required: false })
    readonly marginpcnt?: number;

    @ApiProperty({ description: 'discount percentage (auto-calculated if not provided)', example: '', required: false })
    readonly discountpcnt?: number;

    @ApiProperty({ description: 'reason', example: '' })
    readonly reason:string;
    @ApiProperty({ description: 'comments', example: '' })
    readonly comments?: string;

}