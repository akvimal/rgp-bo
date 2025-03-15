import { ApiProperty } from '@nestjs/swagger';

export class CreateSaleDeliveryDto {

    @ApiProperty({ description: 'sale id', example: 0 })
    readonly saleid: number;
    @ApiProperty({ description: 'booked date', example: '' })
    readonly bookeddate: string;
    @ApiProperty({ description: 'booked by', example: 0 })
    readonly bookedby: number;

    @ApiProperty({ description: 'receiver name', example: 0 })
    readonly receivername: string;
    @ApiProperty({ description: 'receiver phone', example: 0 })
    readonly receiverphone: string;
    @ApiProperty({ description: 'receiver address', example: 0 })
    readonly receiveraddress: string;
  
    @ApiProperty({ description: 'charges', example: 0 })
    readonly charges: number; 

    @ApiProperty({ description: 'delivery date', example: '' })
    readonly deliverydate: string;
    @ApiProperty({ description: 'delivery by', example: 0 })
    readonly deliveryby: number;

    @ApiProperty({ description: 'status', example: '' })
    readonly status: string;
    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;
}