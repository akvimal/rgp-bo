import { ApiProperty } from '@nestjs/swagger';

export class CreateDeliveryPartnerDto {
    @ApiProperty({ description: 'name', example: 'Delhivery' })
    readonly name: string;

    @ApiProperty({ description: 'contact name', example: 'Ops Team' })
    readonly contactname: string;

    @ApiProperty({ description: 'contact phone', example: '9876543210' })
    readonly contactphone: string;

    @ApiProperty({ description: 'address', example: 'City hub' })
    readonly address: string;

    @ApiProperty({ description: 'comments', example: 'Primary courier partner' })
    readonly comments: string;
}
