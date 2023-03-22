import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleDto {

    @ApiProperty({ description: 'id', example: '' })
    readonly id: number;
    
    @ApiProperty({ description: 'bill date', example: '' })
    readonly billdate: string;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;

    @ApiProperty({ description: 'payment mode', example: '' })
    readonly paymode: string;

    @ApiProperty({ description: 'payment refno', example: '' })
    readonly payrefno: string;    
    @ApiProperty({ description: 'consume weeks', example: 0 })
    readonly consumeweeks: number;

    @ApiProperty({ description: 'customer id', example: 0 })
    readonly customerid: number;

    @ApiProperty({ description: 'customer', example: {} })
    readonly customer: any;
}