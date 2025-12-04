import { PartialType } from '@nestjs/mapped-types';
import { CreateShiftDto } from './create-shift.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}
