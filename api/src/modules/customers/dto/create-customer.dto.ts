import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {

    @ApiProperty({ description: 'name', example: '' })
    readonly name: string;
    @ApiProperty({ description: 'mobile', example: '' })
    readonly mobile: string;
    @ApiProperty({ description: 'email', example: '' })
    readonly email: string;
    @ApiProperty({ description: 'location', example: '' })
    readonly location: string;    
    @ApiProperty({ description: 'address', example: '' })
    readonly address: string;    
    @ApiProperty({ description: 'city', example: '' })
    readonly city: string;
    @ApiProperty({ description: 'state', example: '' })
    readonly state: string;
    @ApiProperty({ description: 'pincode', example: '' })
    readonly pincode: string;
    @ApiProperty({ description: 'source type', example: '' })
    readonly srctype: string;
    @ApiProperty({ description: 'source desc', example: '' })
    readonly srcdesc: string;
}