import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class LeaveBalanceQueryDto {
  @IsInt()
  @IsOptional()
  @Min(2020)
  @Max(2099)
  year?: number;

  @IsInt()
  @IsOptional()
  leavetypeid?: number;
}
