import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, Length, Min, Max, IsDateString } from 'class-validator';

export class CreateHsnTaxDto {
  @ApiProperty({ description: 'HSN code (4-8 digits)', example: '30049099' })
  @IsNotEmpty()
  @IsString()
  @Length(4, 8)
  hsncode: string;

  @ApiProperty({ description: 'HSN description', example: 'General Medicine', required: false })
  @IsOptional()
  @IsString()
  hsndescription?: string;

  @ApiProperty({ description: 'CGST rate (%)', example: 6, minimum: 0, maximum: 28 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(28)
  cgstrate: number;

  @ApiProperty({ description: 'SGST rate (%)', example: 6, minimum: 0, maximum: 28 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(28)
  sgstrate: number;

  @ApiProperty({ description: 'IGST rate (%)', example: 12, minimum: 0, maximum: 28 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(28)
  igstrate: number;

  @ApiProperty({ description: 'Tax category', example: 'MEDICINE', required: false })
  @IsOptional()
  @IsString()
  taxcategory?: string;

  @ApiProperty({ description: 'Effective from date', example: '2025-01-01', required: false })
  @IsOptional()
  @IsDateString()
  effectivefrom?: string;

  @ApiProperty({ description: 'Effective to date', example: '2099-12-31', required: false })
  @IsOptional()
  @IsDateString()
  effectiveto?: string;
}
