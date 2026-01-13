import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignSubFeatureDto {
  @ApiProperty({ description: 'Sub-feature ID to assign' })
  @IsInt()
  subFeatureId: number;

  @ApiProperty({ description: 'Access level ID for the sub-feature' })
  @IsInt()
  accessLevelId: number;
}
