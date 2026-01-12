import { IsInt, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignFeatureDto {
  @ApiProperty({ description: 'Role ID to assign feature to' })
  @IsInt()
  roleId: number;

  @ApiProperty({ description: 'Feature group ID to assign' })
  @IsInt()
  featureGroupId: number;

  @ApiProperty({ description: 'Access level ID to grant' })
  @IsInt()
  accessLevelId: number;

  @ApiPropertyOptional({ description: 'Data scope: all, team, or own', default: 'all' })
  @IsString()
  @IsOptional()
  dataScope?: string;

  @ApiPropertyOptional({ description: 'Feature-specific options' })
  @IsObject()
  @IsOptional()
  options?: Record<string, any>;
}
