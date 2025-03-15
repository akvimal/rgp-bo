import { ApiProperty } from '@nestjs/swagger';
import { UpdateInvoiceDto } from './update-invoice.dto';

export class UpdateInvoicesDto {
s
    @ApiProperty({ description: 'ids', example: [] })
    readonly ids: number[];
    
    @ApiProperty({ description: 'values', example: {} })
    readonly values: UpdateInvoiceDto;
    
}