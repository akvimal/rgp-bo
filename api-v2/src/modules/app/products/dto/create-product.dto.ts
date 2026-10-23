import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

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
    @ApiProperty({ description: 'tax percent', example: 0 })
    readonly taxpcnt: number;
    @ApiPropertyOptional({ description: 'category', example: '' })
    @IsOptional()
    readonly category: string;

    @ApiPropertyOptional({ description: 'props', example: '{}' })
    @IsOptional()
    @IsObject()
    readonly props: object;

    @ApiPropertyOptional({ description: 'shelf/rack/bin label, for picking', example: 'A-12' })
    @IsOptional()
    readonly binlocation: string;

    @ApiPropertyOptional({ description: 'units to keep on hand; the reorder list orders up to it', example: 20 })
    @IsOptional()
    @IsInt()
    @Min(0)
    readonly minstock: number | null;
}