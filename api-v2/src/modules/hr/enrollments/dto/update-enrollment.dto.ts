import { IsOptional, IsObject, IsString, IsNumber, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEnrollmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  customCoverageAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  customEmployeeContribution?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dependents?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomineeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nomineeRelationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nomineeDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nomineeContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  nomineePercentage?: number;
}
