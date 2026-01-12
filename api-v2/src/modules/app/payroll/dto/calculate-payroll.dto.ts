import { IsInt, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalculatePayrollDto {
  @ApiProperty({ description: 'Payroll run ID' })
  @IsInt()
  payrollRunId: number;

  @ApiPropertyOptional({ description: 'Specific user IDs to calculate (optional, otherwise all active employees)', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  userIds?: number[];
}
