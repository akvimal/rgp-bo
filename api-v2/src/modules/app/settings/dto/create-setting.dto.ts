import { ApiProperty } from '@nestjs/swagger';

export class CreateSettingDto {
    @ApiProperty({ description: 'category', example: 'purchases' })
    readonly category: string;

    @ApiProperty({ description: 'setting key', example: 'purchase_order_approval_value_threshold' })
    readonly key: string;

    @ApiProperty({ description: 'setting value', example: '5000' })
    readonly value: string;

    @ApiProperty({ description: 'description', example: 'Approval required above this estimated PO value' })
    readonly description: string;
}
