import { IsString, IsNotEmpty, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsNotEmpty()
  storeid: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:MM format',
  })
  starttime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:MM format',
  })
  endtime: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  breakduration?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  graceperiodminutes?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
