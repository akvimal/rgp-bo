import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleDto {

    @ApiProperty({ description: 'id', example: '' })
    readonly id: number;
    
    @ApiProperty({ description: 'bill date', example: '' })
    readonly billdate: string;
    @ApiProperty({ description: 'order date', example: '' })
    readonly orderdate: string;

    @ApiProperty({ description: 'bill no', example: 0 })
    readonly billno: number;    
    @ApiProperty({ description: 'order no', example: 0 })
    readonly orderno: number;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;

    @ApiProperty({ description: 'ordertype', example: '' })
    readonly ordertype: string;
    @ApiProperty({ description: 'deliverytype', example: '' })
    readonly deliverytype: string;
    
    @ApiProperty({ description: 'Digital Payment Method', example: '' })
    readonly digimethod: string | null;
    @ApiProperty({ description: 'Digital Payment RefNo', example: '' })
    readonly digirefno: string | null;
  
    @ApiProperty({ description: 'Digital Payment Amount', example: 0 })
    readonly digiamt: number;
    @ApiProperty({ description: 'Cash Payment Amount', example: 0 })
    readonly cashamt: number;

    @ApiProperty({ description: 'expreturn days', example: 0 })
    readonly expreturndays: number;

    @ApiProperty({ description: 'customer id', example: 0 })
    readonly customerid: number;

    @ApiProperty({ description: 'customer', example: {} })
    readonly customer: any;
}