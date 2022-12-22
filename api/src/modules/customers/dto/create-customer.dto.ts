import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {

    @ApiProperty({ description: 'name', example: '' })
    readonly name: string;
    @ApiProperty({ description: 'mobile', example: '' })
    readonly mobile: string;
    @ApiProperty({ description: 'email', example: '' })
    readonly email: string;
    
    @ApiProperty({ description: 'locality', example: '' })
    readonly locality: string;    
    @ApiProperty({ description: 'address', example: '' })
    readonly address: string;    
    @ApiProperty({ description: 'area', example: '' })
    readonly area: string;
    
    @ApiProperty({ description: 'source type', example: '' })
    readonly srctype: string;
    @ApiProperty({ description: 'source desc', example: '' })
    readonly srcdesc: string;
}