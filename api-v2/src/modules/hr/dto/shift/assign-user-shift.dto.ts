import { IsInt, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, IsDateString, IsString } from 'class-validator';

export class AssignUserShiftDto {
  @IsInt()
  @IsNotEmpty()
  userid: number;

  @IsInt()
  @IsNotEmpty()
  shiftid: number;

  @IsDateString()
  @IsNotEmpty()
  effectivefrom: string;

  @IsDateString()
  @IsOptional()
  effectiveto?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  daysofweek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday

  @IsString()
  @IsOptional()
  notes?: string;
}
