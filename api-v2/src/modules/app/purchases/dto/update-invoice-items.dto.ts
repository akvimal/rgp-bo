import { ApiProperty } from '@nestjs/swagger';
import { UpdatePurchaseInvoiceItemDto } from './update-invoice-item.dto';

export class UpdateInvoiceItemsDto {

    @ApiProperty({ description: 'ids', example: [] })
    readonly ids: number[];
    
    @ApiProperty({ description: 'values', example: {} })
    readonly values: UpdatePurchaseInvoiceItemDto;
    
}