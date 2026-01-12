import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PayrollRun } from '../../../../entities/payroll-run.entity';
import { PayrollDetail } from '../../../../entities/payroll-detail.entity';
import { EmployeeSalaryStructure } from '../../../../entities/employee-salary-structure.entity';
import { AppUser } from '../../../../entities/appuser.entity';
import { PayrollCalculationService } from './payroll-calculation.service';
import { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import { CalculatePayrollDto } from '../dto/calculate-payroll.dto';

@Injectable()
export class PayrollRunService {
  private readonly logger = new Logger(PayrollRunService.name);

  constructor(
    @InjectRepository(PayrollRun)
    private payrollRunRepo: Repository<PayrollRun>,
    @InjectRepository(PayrollDetail)
    private payrollDetailRepo: Repository<PayrollDetail>,
    @InjectRepository(EmployeeSalaryStructure)
    private salaryStructureRepo: Repository<EmployeeSalaryStructure>,
    @InjectRepository(AppUser)
    private userRepo: Repository<AppUser>,
    private dataSource: DataSource,
    private calculationService: PayrollCalculationService,
  ) {}

  /**
   * Create a new payroll run
   */
  async createPayrollRun(dto: CreatePayrollRunDto, userId: number): Promise<PayrollRun> {
    try {
      // Check if payroll run already exists for this period
      const existing = await this.payrollRunRepo.findOne({
        where: {
          year: dto.year,
          month: dto.month,
          active: true,
        },
      });

      if (existing) {
        throw new HttpException(
          `Payroll run already exists for ${dto.month}/${dto.year}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Calculate period dates
      const periodStartDate = new Date(dto.year, dto.month - 1, 1);
      const periodEndDate = new Date(dto.year, dto.month, 0);

      // Create payroll run
      const payrollRun = this.payrollRunRepo.create({
        year: dto.year,
        month: dto.month,
        periodStartDate,
        periodEndDate,
        title: dto.title || `${this.getMonthName(dto.month)} ${dto.year} Payroll`,
        description: dto.description,
        status: 'DRAFT',
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await this.payrollRunRepo.save(payrollRun);

      this.logger.log(`Created payroll run ${saved.id} for ${dto.month}/${dto.year}`);
      return saved;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error creating payroll run: ${error.message}`, error.stack);
      throw new HttpException('Failed to create payroll run', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Calculate payroll for employees
   */
  async calculatePayroll(dto: CalculatePayrollDto, userId: number): Promise<any> {
    return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      try {
        // Get payroll run
        const payrollRun = await manager.findOne(PayrollRun, {
          where: { id: dto.payrollRunId, active: true },
        });

        if (!payrollRun) {
          throw new HttpException('Payroll run not found', HttpStatus.NOT_FOUND);
        }

        if (payrollRun.status !== 'DRAFT') {
          throw new HttpException(
            `Cannot calculate payroll for status: ${payrollRun.status}`,
            HttpStatus.BAD_REQUEST,
          );
        }

        // Get employees to calculate
        let employeeIds: number[];
        if (dto.userIds && dto.userIds.length > 0) {
          employeeIds = dto.userIds;
        } else {
          // Get all employees with active salary structures
          const structures = await manager.find(EmployeeSalaryStructure, {
            where: { active: true },
            select: ['userId'],
          });
          employeeIds = structures.map(s => s.userId);
        }

        this.logger.log(`Calculating payroll for ${employeeIds.length} employees`);

        // Calculate for each employee
        const results: PayrollDetail[] = [];
        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];

        for (const employeeId of employeeIds) {
          try {
            const detail = await this.calculationService.calculateEmployeePayroll(
              manager,
              payrollRun,
              employeeId,
              payrollRun.year,
              payrollRun.month,
              userId,
            );
            results.push(detail);
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push({
              employeeId,
              error: error.message,
            });
            this.logger.error(`Error calculating payroll for employee ${employeeId}: ${error.message}`);
          }
        }

        // Update payroll run summary
        const totalGross = results.reduce((sum, d) => sum + Number(d.grossSalary), 0);
        const totalDeductions = results.reduce((sum, d) => sum + Number(d.totalDeductions), 0);
        const totalNet = results.reduce((sum, d) => sum + Number(d.netSalary), 0);

        // Calculate total employer contributions
        const totalEmployerContrib = results.reduce((sum, d) => {
          const contribs = d.employerContributions || {};
          return sum + Object.values(contribs).reduce((s: number, v: any) => s + Number(v), 0);
        }, 0);

        payrollRun.totalEmployees = successCount;
        payrollRun.totalGrossSalary = totalGross;
        payrollRun.totalDeductions = totalDeductions;
        payrollRun.totalNetSalary = totalNet;
        payrollRun.totalEmployerContributions = totalEmployerContrib;
        payrollRun.status = 'CALCULATED';
        payrollRun.calculatedOn = new Date();
        payrollRun.calculatedBy = userId;
        payrollRun.updatedBy = userId;

        await manager.save(PayrollRun, payrollRun);

        this.logger.log(
          `Payroll calculation complete: ${successCount} success, ${errorCount} errors`,
        );

        return {
          payrollRunId: payrollRun.id,
          status: 'CALCULATED',
          totalEmployees: successCount,
          totalGrossSalary: totalGross,
          totalDeductions: totalDeductions,
          totalNetSalary: totalNet,
          totalEmployerContributions: totalEmployerContrib,
          successCount,
          errorCount,
          errors: errorCount > 0 ? errors : undefined,
        };
      } catch (error) {
        if (error instanceof HttpException) throw error;
        this.logger.error(`Error in payroll calculation transaction: ${error.message}`, error.stack);
        throw new HttpException('Payroll calculation failed', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }

  /**
   * Get payroll run by ID
   */
  async getPayrollRun(id: number): Promise<PayrollRun> {
    const payrollRun = await this.payrollRunRepo.findOne({
      where: { id, active: true },
    });

    if (!payrollRun) {
      throw new HttpException('Payroll run not found', HttpStatus.NOT_FOUND);
    }

    return payrollRun;
  }

  /**
   * Get payroll run with details
   */
  async getPayrollRunWithDetails(id: number): Promise<any> {
    const payrollRun = await this.getPayrollRun(id);

    const details = await this.payrollDetailRepo.find({
      where: { payrollRunId: id, active: true },
      relations: ['user'],
      order: { userId: 'ASC' },
    });

    return {
      ...payrollRun,
      details,
    };
  }

  /**
   * Get all payroll runs
   */
  async getAllPayrollRuns(year?: number): Promise<PayrollRun[]> {
    const where: any = { active: true };
    if (year) {
      where.year = year;
    }

    return await this.payrollRunRepo.find({
      where,
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  /**
   * Approve payroll run
   */
  async approvePayrollRun(id: number, userId: number, remarks?: string): Promise<PayrollRun> {
    try {
      const payrollRun = await this.getPayrollRun(id);

      if (payrollRun.status !== 'CALCULATED') {
        throw new HttpException(
          `Cannot approve payroll with status: ${payrollRun.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      payrollRun.status = 'APPROVED';
      payrollRun.approvedOn = new Date();
      payrollRun.approvedBy = userId;
      payrollRun.approvalRemarks = remarks || null;
      payrollRun.updatedBy = userId;

      const saved = await this.payrollRunRepo.save(payrollRun);

      this.logger.log(`Payroll run ${id} approved by user ${userId}`);
      return saved;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error approving payroll run: ${error.message}`, error.stack);
      throw new HttpException('Failed to approve payroll run', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get payroll detail by employee
   */
  async getEmployeePayrollDetail(payrollRunId: number, userId: number): Promise<PayrollDetail> {
    const detail = await this.payrollDetailRepo.findOne({
      where: {
        payrollRunId,
        userId,
        active: true,
      },
      relations: ['user'],
    });

    if (!detail) {
      throw new HttpException('Payroll detail not found', HttpStatus.NOT_FOUND);
    }

    return detail;
  }

  /**
   * Helper: Get month name
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[month - 1];
  }
}
