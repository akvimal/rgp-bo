import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class ReceiveStoreStockTransferDto {

    @ApiProperty({ required: false, description: 'defaults to the dispatched quantity; a lower value records a short receipt' })
    @IsOptional()
    @IsInt()
    @IsPositive()
    readonly receivedqty?: number;
}
