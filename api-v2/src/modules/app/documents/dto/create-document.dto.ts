import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

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
    @ApiProperty({ description: 'category', example: '' })
    @IsOptional()
    readonly category: string;

    @ApiProperty({ description: 'alias', example: '' })
    @IsOptional()
    readonly alias: string;

    @ApiPropertyOptional({ description: 'document props', example: '{}' })
    @IsOptional()
    @IsObject()
    readonly docprops: object;
    @ApiPropertyOptional({ description: 'upload props', example: '{}' })
    @IsOptional()
    @IsObject()
    readonly uploadprops: object;
}