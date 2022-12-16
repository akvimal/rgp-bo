import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseInvoiceDto {

    @ApiProperty({ description: 'ID', example: '' })
    readonly id: number;
    
    @ApiProperty({ description: 'invoice no', example: '' })
    readonly invoiceno: string;
    
    @ApiProperty({ description: 'invoice date', example: '' })
    readonly invoicedate: string;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;

    @ApiProperty({ description: 'grn', example: '' })
    readonly grn: string;

    @ApiProperty({ description: 'total', example: 0 })
    readonly total: number;

    @ApiProperty({ description: 'vendor id', example: 0 })
    readonly vendorid: number;
    
    @ApiProperty({ description: 'purchase order id', example: '' })
    readonly purchaseorderid: string;

    @ApiProperty({ description: 'items', example: [] })
    readonly items: [];

}