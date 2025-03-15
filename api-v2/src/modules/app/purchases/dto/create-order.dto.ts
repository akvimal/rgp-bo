import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseOrderDto {

    @ApiProperty({ description: 'ID', example: '' })
    readonly id: number;
    
    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;

    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;

    @ApiProperty({ description: 'po number', example: '' })
    readonly ponumber: string;
    
    @ApiProperty({ description: 'vendor id', example: 0 })
    readonly vendorid: number;

}