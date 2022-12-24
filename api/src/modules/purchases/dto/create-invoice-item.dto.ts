import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseInvoiceItemDto {

    @ApiProperty({ description: 'invoice id', example: 0 })
    readonly invoiceid: number;
    
    @ApiProperty({ description: 'product id', example: 0 })
    readonly productid: number;

    @ApiProperty({ description: 'batch', example: '' })
    readonly batch: string;
  
    @ApiProperty({ description: 'exp date', example: '' })
    readonly expdate: string;
  
    @ApiProperty({ description: 'ptr cost', example: 0 })
    readonly ptrcost: number;

    @ApiProperty({ description: 'mrp cost', example: 0 })
    readonly mrpcost: number;

    @ApiProperty({ description: 'disc percent', example: 0 })
    readonly discpcnt: number;
    
    @ApiProperty({ description: 'tax percent', example: 0 })
    readonly taxpcnt: number;

    @ApiProperty({ description: 'sale price', example: 0 })
    readonly saleprice: number;
  
    @ApiProperty({ description: 'quantity', example: 0 })
    readonly qty: number;

    @ApiProperty({ description: 'total', example: 0 })
    readonly total: number;

    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;
    
    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;
}