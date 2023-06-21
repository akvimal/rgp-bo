import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleReturnDto {
    
    @ApiProperty({ description: 'sale item id', example: 0 })
    readonly saleitemid: number;
    
    @ApiProperty({ description: 'quantity', example: 0 })
    readonly qty: number;

    @ApiProperty({ description: 'paymode', example: '' })
    readonly paymode: string;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;
    
    @ApiProperty({ description: 'reason', example: '' })
    readonly reason: string;

    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;

}