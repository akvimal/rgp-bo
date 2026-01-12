import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../../auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';
import { PayrollRunService } from './services/payroll-run.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { CalculatePayrollDto } from './dto/calculate-payroll.dto';
import { PayrollRunResponseDto } from './dto/payroll-run-response.dto';
import { EmployeeSalaryStructure } from '../../../entities/employee-salary-structure.entity';

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('payroll')
@UseGuards(AuthGuard)
export class PayrollController {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    @InjectRepository(EmployeeSalaryStructure)
    private readonly salaryStructureRepository: Repository<EmployeeSalaryStructure>,
  ) {}

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payroll run' })
  @ApiResponse({ status: 201, description: 'Payroll run created successfully', type: PayrollRunResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - Payroll run already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPayrollRun(
    @Body() dto: CreatePayrollRunDto,
    @User() user: any,
  ): Promise<PayrollRunResponseDto> {
    return await this.payrollRunService.createPayrollRun(dto, user.id);
  }

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate payroll for employees' })
  @ApiResponse({ status: 200, description: 'Payroll calculated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid payroll run status' })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async calculatePayroll(
    @Body() dto: CalculatePayrollDto,
    @User() user: any,
  ): Promise<any> {
    return await this.payrollRunService.calculatePayroll(dto, user.id);
  }

  @Get('run/:id')
  @ApiOperation({ summary: 'Get payroll run by ID' })
  @ApiResponse({ status: 200, description: 'Payroll run retrieved successfully', type: PayrollRunResponseDto })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPayrollRun(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PayrollRunResponseDto> {
    return await this.payrollRunService.getPayrollRun(id);
  }

  @Get('run/:id/details')
  @ApiOperation({ summary: 'Get payroll run with all employee details' })
  @ApiResponse({ status: 200, description: 'Payroll run with details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPayrollRunWithDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<any> {
    return await this.payrollRunService.getPayrollRunWithDetails(id);
  }

  @Get('runs')
  @ApiOperation({ summary: 'Get all payroll runs' })
  @ApiResponse({ status: 200, description: 'Payroll runs retrieved successfully', type: [PayrollRunResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllPayrollRuns(
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ): Promise<PayrollRunResponseDto[]> {
    return await this.payrollRunService.getAllPayrollRuns(year);
  }

  @Post('run/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve payroll run' })
  @ApiResponse({ status: 200, description: 'Payroll run approved successfully', type: PayrollRunResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid status for approval' })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async approvePayrollRun(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @Body('remarks') remarks?: string,
  ): Promise<PayrollRunResponseDto> {
    return await this.payrollRunService.approvePayrollRun(id, user.id, remarks);
  }

  @Get('run/:payrollRunId/employee/:userId')
  @ApiOperation({ summary: 'Get payroll detail for a specific employee' })
  @ApiResponse({ status: 200, description: 'Employee payroll detail retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payroll detail not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getEmployeePayrollDetail(
    @Param('payrollRunId', ParseIntPipe) payrollRunId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<any> {
    return await this.payrollRunService.getEmployeePayrollDetail(payrollRunId, userId);
  }

  @Get('salary-structures')
  @ApiOperation({ summary: 'Get all employee salary structures' })
  @ApiResponse({ status: 200, description: 'Salary structures retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllSalaryStructures(): Promise<EmployeeSalaryStructure[]> {
    return await this.salaryStructureRepository.find({
      where: { active: true },
      relations: ['user', 'employmentType', 'role'],
      order: { createdOn: 'DESC' },
    });
  }

  @Get('salary-structures/:userId')
  @ApiOperation({ summary: 'Get salary structure for a specific user' })
  @ApiResponse({ status: 200, description: 'Salary structure retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Salary structure not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserSalaryStructure(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<EmployeeSalaryStructure | null> {
    return await this.salaryStructureRepository.findOne({
      where: { userId, active: true },
      relations: ['user', 'employmentType', 'role'],
    });
  }
}
