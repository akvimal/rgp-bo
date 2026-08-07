import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreatePurchaseRequestDto {

    @ApiProperty({ description: 'ID', example: '' })
    @IsOptional()
    @IsNumber()
    readonly id: number;

    @ApiProperty({ description: 'status', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly status: string;

    @ApiProperty({ description: 'request type', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly requesttype: string;

    @ApiProperty({ description: 'request source', example: 'Customer' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly source: string;

    @ApiProperty({ description: 'priority', example: 'Normal' })
    @IsOptional()
    @IsIn(['Low', 'Normal', 'High', 'Urgent'])
    readonly priority: string;

    @ApiProperty({ description: 'comments', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly comments: string;

    @ApiProperty({ description: 'notes', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly notes: string;

    @ApiProperty({ description: 'qty', example: 0 })
    @IsNumber()
    @Min(0)
    readonly qty: number;

    @ApiProperty({ description: 'suggested qty', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly suggestedqty: number;

    @ApiProperty({ description: 'ordered qty', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly orderedqty: number;

    @ApiProperty({ description: 'fulfilled qty', example: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    readonly fulfilledqty: number;

    @ApiProperty({ description: 'product id', example: 0 })
    @IsNumber()
    @IsPositive()
    readonly productid: number;

    @ApiProperty({ description: 'order id', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly orderid: number;

    @ApiProperty({ description: 'vendor id', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly vendorid: number;

    @ApiProperty({ description: 'customer name', example: 'Aarav Kumar' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly customername: string;

    @ApiProperty({ description: 'customer phone', example: '9000000001' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    readonly customerphone: string;

    @ApiProperty({ description: 'needed by date', example: '2026-07-02' })
    @IsOptional()
    @IsDateString()
    readonly neededby: string;

    @ApiProperty({ description: 'source reference', example: 'walk-in special order' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly sourceref: string;

}
