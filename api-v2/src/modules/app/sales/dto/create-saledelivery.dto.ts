import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateSaleDeliveryDto {

    @ApiProperty({ description: 'sale id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly saleid: number;

    @ApiProperty({ description: 'booked date', example: '' })
    @IsOptional()
    @IsString()
    readonly bookeddate: string;

    @ApiProperty({ description: 'booked by', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly bookedby: number;

    @ApiProperty({ description: 'receiver name', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly receivername: string;

    @ApiProperty({ description: 'receiver phone', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    readonly receiverphone: string;

    @ApiProperty({ description: 'receiver address', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly receiveraddress: string;

    @ApiProperty({ description: 'charges', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly charges: number;

    @ApiProperty({ description: 'delivery date', example: '' })
    @IsOptional()
    @IsString()
    readonly deliverydate: string;

    @ApiProperty({ description: 'delivery by', example: 'Rider A' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly deliveryby: string;

    @ApiProperty({ description: 'delivery method', example: 'Staff Delivery' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly deliverymethod: string;

    @ApiProperty({ description: 'courier partner', example: 'BlueDart' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly courierpartner: string;

    @ApiProperty({ description: 'delivered at', example: '2026-07-01T12:00:00.000Z' })
    @IsOptional()
    @IsString()
    readonly deliveredat: string;

    @ApiProperty({ description: 'delivery confirmed', example: true })
    @IsOptional()
    @IsBoolean()
    readonly confirmed: boolean;

    @ApiProperty({ description: 'confirmed by', example: 'Customer' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly confirmedby: string;

    @ApiProperty({ description: 'confirmed at', example: '2026-07-01T12:00:00.000Z' })
    @IsOptional()
    @IsString()
    readonly confirmedat: string;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;

    @ApiProperty({ description: 'actual cost', example: 80 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly actualcost: number;

    @ApiProperty({ description: 'payment mode', example: 'Collect by Courier' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    readonly paymentmode: string;

    @ApiProperty({ description: 'collection status', example: 'Pending' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly collectionstatus: string;

    @ApiProperty({ description: 'failure reason', example: 'Customer unavailable' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly failurereason: string;

    @ApiProperty({ description: 'comments', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly comments: string;
}
