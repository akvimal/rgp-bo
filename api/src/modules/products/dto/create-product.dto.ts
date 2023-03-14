import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreateProductDto {

    @ApiProperty({ description: 'title', required:true, example: '' })
    readonly title: string;
    
    @ApiPropertyOptional({ description: 'description', example: '' })
    @IsOptional()
    readonly description: string;

    @ApiPropertyOptional({ description: 'product code', example: '' })
    @IsOptional()
    readonly code: string;

    @ApiPropertyOptional({ description: 'hsn code', example: '' })
    @IsOptional()
    readonly hsn: string;
    
    @ApiPropertyOptional({ description: 'manufacturer', example: '' })
    @IsOptional()
    readonly mfr: string;

    @ApiPropertyOptional({ description: 'brand', example: '' })
    @IsOptional()
    readonly brand: string;

    @ApiPropertyOptional({ description: 'pack', example: 0 })
    readonly pack: number;

    @ApiPropertyOptional({ description: 'category', example: '' })
    @IsOptional()
    readonly category: string;

    @ApiPropertyOptional({ description: 'props', example: '{}' })
    @IsOptional()
    @IsObject()
    readonly props: object;
}