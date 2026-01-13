import { IsInt, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFeatureAssignmentDto {
  @ApiPropertyOptional({ description: 'New access level ID' })
  @IsInt()
  @IsOptional()
  accessLevelId?: number;

  @ApiPropertyOptional({ description: 'New data scope: all, team, or own' })
  @IsString()
  @IsOptional()
  dataScope?: string;

  @ApiPropertyOptional({ description: 'Updated feature-specific options' })
  @IsObject()
  @IsOptional()
  options?: Record<string, any>;
}
