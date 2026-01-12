import { IsEnum, IsOptional, IsString, IsInt, IsNumber, IsDate } from 'class-validator';
import { AttendanceStatus } from 'src/entities/attendance.entity';
import { Type } from 'class-transformer';

export class UpdateAttendanceDto {
  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsInt()
  @IsOptional()
  shiftid?: number;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  clockintime?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  clockouttime?: Date;

  @IsNumber()
  @IsOptional()
  totalhours?: number;

  @IsString()
  @IsOptional()
  remarks?: string;
}
