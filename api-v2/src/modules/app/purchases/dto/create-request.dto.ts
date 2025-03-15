import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseRequestDto {

    @ApiProperty({ description: 'ID', example: '' })
    readonly id: number;
    
    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;

    @ApiProperty({ description: 'request type', example: '' })
    readonly requesttype: string;

    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;

    @ApiProperty({ description: 'qty', example: 0 })
    readonly qty: number;

    @ApiProperty({ description: 'product id', example: 0 })
    readonly productid: number;
    
    @ApiProperty({ description: 'order id', example: 0 })
    readonly orderid: number;

}