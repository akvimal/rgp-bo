import { ApiProperty } from '@nestjs/swagger';

export class PayrollRunResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  year: number;

  @ApiProperty()
  month: number;

  @ApiProperty()
  periodStartDate: Date;

  @ApiProperty()
  periodEndDate: Date;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalEmployees: number;

  @ApiProperty()
  totalGrossSalary: number;

  @ApiProperty()
  totalDeductions: number;

  @ApiProperty()
  totalNetSalary: number;

  @ApiProperty()
  totalEmployerContributions: number;

  @ApiProperty({ required: false })
  calculatedOn: Date | null;

  @ApiProperty({ required: false })
  calculatedBy: number | null;

  @ApiProperty({ required: false })
  approvedOn: Date | null;

  @ApiProperty({ required: false })
  approvedBy: number | null;

  @ApiProperty({ required: false })
  approvalRemarks: string | null;

  @ApiProperty()
  createdOn: Date;

  @ApiProperty()
  updatedOn: Date;
}
