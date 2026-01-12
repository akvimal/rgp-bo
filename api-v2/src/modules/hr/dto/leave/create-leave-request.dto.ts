import { IsInt, IsNotEmpty, IsDateString, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsInt()
  @IsNotEmpty()
  leavetypeid: number;

  @IsDateString()
  @IsNotEmpty()
  startdate: string;

  @IsDateString()
  @IsNotEmpty()
  enddate: string;

  @IsNumber()
  @Min(0.5)
  @IsNotEmpty()
  totaldays: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  documenturl?: string;
}
