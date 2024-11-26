import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateDocumentDto {

    @ApiProperty({ description: 'name', example: '' })
    @IsOptional()
    readonly name: string;

    @ApiProperty({ description: 'path', example: '' })
    @IsOptional()
    readonly path: string;
    
    @ApiProperty({ description: 'extn', example: '' })
    @IsOptional()
    readonly extn: string;

}