import { ApiProperty } from '@nestjs/swagger';
import { CreateSaleItemDto } from './create-saleitem.dto';

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

    @ApiProperty({ description: 'customer id', example: 0 })
    readonly customerid: number;

    @ApiProperty({ description: 'customer', example: {} })
    readonly customer: any;
  
    // @ApiProperty({ description: 'items', example: [] })
    // readonly items: CreateSaleItemDto[]
}