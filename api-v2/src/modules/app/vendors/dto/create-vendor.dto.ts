import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreateVendorDto {

    @ApiProperty({ description: 'business name', example: '' })
    readonly name: string;
    @ApiProperty({ description: 'contact name', example: '' })
    readonly contactname: string;
    @ApiProperty({ description: 'contact phone', example: '' })
    readonly contactphone: string;
    @ApiProperty({ description: 'address', example: '' })
    readonly address: string;
    @ApiProperty({ description: 'gstn', example: '' })
    readonly gstn: string;    
    @ApiProperty({ description: 'comments', example: '' })
    readonly comments: string;
    @ApiPropertyOptional({ description: 'props', example: '{}' })
    @IsOptional()
    @IsObject()
    readonly props: object;
}