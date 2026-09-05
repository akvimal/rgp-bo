import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateStoreStockTransferDto {

    @ApiProperty({ description: 'source store id' })
    @IsInt()
    @IsPositive()
    readonly fromstoreid: number;

    @ApiProperty({ description: 'destination store id' })
    @IsInt()
    @IsPositive()
    readonly tostoreid: number;

    @ApiProperty({ description: 'purchase_invoice_item id (the batch being moved)' })
    @IsInt()
    @IsPositive()
    readonly purchaseitemid: number;

    @ApiProperty({ description: 'quantity to transfer, in sale units' })
    @IsInt()
    @IsPositive()
    readonly qty: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly notes?: string;
}
