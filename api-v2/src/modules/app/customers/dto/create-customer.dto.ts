import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {

    @ApiProperty({ description: 'name', example: '' })
    readonly name: string;
    @ApiProperty({ description: 'mobile', example: '' })
    readonly mobile: string;
    @ApiProperty({ description: 'a second number: a family member, or another line', required: false })
    readonly altmobile?: string;
    @ApiProperty({ description: 'email', example: '' })
    readonly email: string;
    
    @ApiProperty({ description: 'how this person is related to others on the same number: SELF, SPOUSE, CHILD, PARENT or OTHER', required: false })
    readonly relationship?: string;

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

    @ApiProperty({ description: 'YES or NO to messages, blank when not asked', required: false })
    readonly consent?: string;
    @ApiProperty({ description: 'never contact this customer', required: false })
    readonly donotcontact?: boolean;
    @ApiProperty({ description: 'asked not to be invited to review the store', required: false })
    readonly reviewoptout?: boolean;
    @ApiProperty({ description: 'CALL, WHATSAPP or SMS', required: false })
    readonly preferredchannel?: string;
    @ApiProperty({ description: 'en or ta: language of WhatsApp messages', required: false })
    readonly messagelanguage?: string;

    @ApiProperty({ description: 'confirm a different person on a mobile another customer already has', required: false })
    readonly confirmduplicate?: boolean;
    @ApiProperty({ description: 'set when editing', required: false })
    readonly id?: number;
}