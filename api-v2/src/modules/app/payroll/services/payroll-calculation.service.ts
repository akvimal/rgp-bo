import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, Between } from 'typeorm';
import { EmployeeSalaryStructure } from '../../../../entities/employee-salary-structure.entity';
import { MonthlyKpiScore } from '../../../../entities/monthly-kpi-score.entity';
import { PayrollDetail } from '../../../../entities/payroll-detail.entity';
import { PayrollRun } from '../../../../entities/payroll-run.entity';

@Injectable()
export class PayrollCalculationService {
  private readonly logger = new Logger(PayrollCalculationService.name);

  constructor(
    @InjectRepository(EmployeeSalaryStructure)
    private salaryStructureRepo: Repository<EmployeeSalaryStructure>,
    @InjectRepository(MonthlyKpiScore)
    private kpiScoreRepo: Repository<MonthlyKpiScore>,
  ) {}

  /**
   * Calculate payroll for an employee
   */
  async calculateEmployeePayroll(
    manager: EntityManager,
    payrollRun: PayrollRun,
    userId: number,
    year: number,
    month: number,
    createdBy: number,
  ): Promise<PayrollDetail> {
    try {
      // 1. Get active salary structure
      const salaryStructure = await this.getSalaryStructure(manager, userId);
      if (!salaryStructure) {
        throw new Error(`No active salary structure found for user ${userId}`);
      }

      // 2. Get work data (attendance, KPI, etc.)
      const workData = await this.getWorkData(
        manager,
        userId,
        year,
        month,
        salaryStructure.employmentTypeCode,
      );

      // 3. Route to appropriate calculator based on payment model
      let earnings: any;
      let deductions: any;

      switch (salaryStructure.paymentModel) {
        case 'MONTHLY_FIXED':
          earnings = await this.calculateMonthlyFixedEarnings(
            manager,
            salaryStructure,
            workData,
            year,
            month,
          );
          deductions = await this.calculateMonthlyFixedDeductions(
            manager,
            salaryStructure,
            earnings,
            workData,
          );
          break;

        case 'RETAINER_PLUS_PERDAY':
          earnings = await this.calculateRetainerPlusPerdayEarnings(
            manager,
            salaryStructure,
            workData,
            year,
            month,
          );
          deductions = await this.calculateRetainerDeductions(
            manager,
            salaryStructure,
            earnings,
            workData,
          );
          break;

        case 'HOURLY':
          earnings = await this.calculateHourlyEarnings(
            manager,
            salaryStructure,
            workData,
            year,
            month,
          );
          deductions = await this.calculateHourlyDeductions(
            manager,
            salaryStructure,
            earnings,
            workData,
          );
          break;

        default:
          throw new Error(`Unsupported payment model: ${salaryStructure.paymentModel}`);
      }

      // 4. Calculate employer contributions
      const employerContributions = await this.calculateEmployerContributions(
        manager,
        salaryStructure,
        earnings,
      );

      // 5. Create payroll detail record
      const payrollDetail = manager.create(PayrollDetail, {
        payrollRunId: payrollRun.id,
        userId: userId,
        employmentTypeCode: salaryStructure.employmentTypeCode,
        roleCode: salaryStructure.roleCode,
        paymentModel: salaryStructure.paymentModel,
        year,
        month,

        // Work data
        totalWorkingDays: workData.totalWorkingDays,
        actualDaysWorked: workData.actualDaysWorked,
        presentDays: workData.presentDays,
        paidLeaveDays: workData.paidLeaveDays,
        lwpDays: workData.lwpDays,
        hoursWorked: workData.hoursWorked,

        // Financials
        earningsBreakdown: earnings.breakdown,
        grossSalary: earnings.gross,
        deductionsBreakdown: deductions.breakdown,
        totalDeductions: deductions.total,
        employerContributions: employerContributions,
        netSalary: Number(earnings.gross) - Number(deductions.total),

        // KPI
        kpiScore: workData.kpiScore,
        kpiBreakdown: workData.kpiBreakdown,
        kpiIncentiveAmount: earnings.breakdown.KPI_INCENTIVE || 0,

        paymentStatus: 'PENDING',
        calculationMetadata: {
          calculatedAt: new Date(),
          workData,
          earningsDetail: earnings.detail,
          deductionsDetail: deductions.detail,
        },
        createdBy,
        updatedBy: createdBy,
      });

      return await manager.save(PayrollDetail, payrollDetail);
    } catch (error) {
      this.logger.error(`Error calculating payroll for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get active salary structure for employee
   */
  private async getSalaryStructure(
    manager: EntityManager,
    userId: number,
  ): Promise<EmployeeSalaryStructure | null> {
    return await manager.findOne(EmployeeSalaryStructure, {
      where: {
        userId,
        active: true,
      },
    });
  }

  /**
   * MONTHLY FIXED CALCULATOR (Associate, Senior)
   */
  private async calculateMonthlyFixedEarnings(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    workData: any,
    year: number,
    month: number,
  ): Promise<any> {
    const components = salaryStructure.salaryComponents;
    const breakdown: any = {};
    let gross = 0;

    // Add all fixed components
    for (const [code, amount] of Object.entries(components)) {
      breakdown[code] = amount;
      gross += Number(amount);
    }

    // Add KPI incentive
    const kpiIncentive = await this.calculateKPIIncentive(
      manager,
      salaryStructure,
      workData.kpiScore,
    );
    breakdown.KPI_INCENTIVE = kpiIncentive;
    gross += kpiIncentive;

    return {
      breakdown,
      gross,
      detail: {
        fixedComponents: components,
        kpiIncentive,
      },
    };
  }

  /**
   * RETAINER + PER-DAY CALCULATOR (Part-time)
   */
  private async calculateRetainerPlusPerdayEarnings(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    workData: any,
    year: number,
    month: number,
  ): Promise<any> {
    const breakdown: any = {};
    let gross = 0;

    // Base retainer (covers included days)
    const retainer = salaryStructure.monthlyRetainer;
    breakdown.RETAINER = retainer;
    gross += Number(retainer);

    // Extra days calculation
    const includedDays = salaryStructure.includedDays;
    const actualDays = workData.actualDaysWorked;
    const extraDays = Math.max(0, actualDays - includedDays);

    if (extraDays > 0) {
      const extraDaysAmount = extraDays * Number(salaryStructure.perDayRate);
      breakdown.EXTRA_DAYS = extraDaysAmount;
      gross += extraDaysAmount;
    }

    // KPI incentive
    const kpiIncentive = await this.calculateKPIIncentive(
      manager,
      salaryStructure,
      workData.kpiScore,
    );
    breakdown.KPI_INCENTIVE = kpiIncentive;
    gross += kpiIncentive;

    return {
      breakdown,
      gross,
      detail: {
        retainer,
        includedDays,
        actualDays,
        extraDays,
        perDayRate: salaryStructure.perDayRate,
        extraDaysAmount: breakdown.EXTRA_DAYS || 0,
        kpiIncentive,
      },
    };
  }

  /**
   * HOURLY CALCULATOR (Future)
   */
  private async calculateHourlyEarnings(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    workData: any,
    year: number,
    month: number,
  ): Promise<any> {
    const breakdown: any = {};
    const hoursWorked = workData.hoursWorked || 0;
    const hourlyRate = Number(salaryStructure.hourlyRate);

    const gross = hoursWorked * hourlyRate;
    breakdown.HOURLY_WAGES = gross;

    return {
      breakdown,
      gross,
      detail: {
        hoursWorked,
        hourlyRate,
      },
    };
  }

  /**
   * KPI INCENTIVE CALCULATOR (Universal)
   */
  private async calculateKPIIncentive(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    kpiScore: number,
  ): Promise<number> {
    if (!salaryStructure.kpiEligible || !kpiScore) {
      return 0;
    }

    const bands = salaryStructure.kpiPayoutBands as any;

    if (kpiScore >= 90) {
      return Number(bands['90-100'] || 0);
    } else if (kpiScore >= 75) {
      return Number(bands['75-89'] || 0);
    } else if (kpiScore >= 60) {
      return Number(bands['60-74'] || 0);
    } else if (kpiScore >= 50) {
      return Number(bands['50-59'] || 0);
    } else {
      return Number(bands['below-50'] || bands['below-60'] || 0);
    }
  }

  /**
   * DEDUCTIONS CALCULATOR (Full-time)
   */
  private async calculateMonthlyFixedDeductions(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    earnings: any,
    workData: any,
  ): Promise<any> {
    const breakdown: any = {};
    let total = 0;

    const components = salaryStructure.salaryComponents;
    const basic = Number(components.BASIC || 0);
    const gross = Number(earnings.gross);

    // PF (if applicable)
    if (salaryStructure.pfApplicable) {
      const pfEmployee = basic * (salaryStructure.pfEmployeePercentage / 100);
      breakdown.PF_EMPLOYEE = Math.round(pfEmployee);
      total += breakdown.PF_EMPLOYEE;
    }

    // ESI (if applicable and gross < threshold)
    if (salaryStructure.esiApplicable && gross < 21000) {
      const esiEmployee = gross * (salaryStructure.esiEmployeePercentage / 100);
      breakdown.ESI_EMPLOYEE = Math.round(esiEmployee);
      total += breakdown.ESI_EMPLOYEE;
    }

    // Professional Tax
    if (salaryStructure.ptApplicable) {
      breakdown.PT = this.calculateProfessionalTax(gross);
      total += breakdown.PT;
    }

    // TDS (placeholder - would need actual calculation)
    if (salaryStructure.tdsApplicable) {
      breakdown.TDS = 0; // TODO: Implement TDS calculation
      total += breakdown.TDS;
    }

    // LWP Deduction
    if (workData.lwpDays > 0) {
      const perDaySalary = gross / workData.totalWorkingDays;
      breakdown.LWP = Math.round(workData.lwpDays * perDaySalary);
      total += breakdown.LWP;
    }

    return {
      breakdown,
      total,
      detail: {
        basic,
        gross,
        pfApplicable: salaryStructure.pfApplicable,
        esiApplicable: salaryStructure.esiApplicable,
        lwpDays: workData.lwpDays,
      },
    };
  }

  /**
   * DEDUCTIONS CALCULATOR (Part-time)
   */
  private async calculateRetainerDeductions(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    earnings: any,
    workData: any,
  ): Promise<any> {
    const breakdown: any = {};
    let total = 0;

    // Part-time: NO PF, ESI, PT (per document)
    // Only TDS if applicable
    if (salaryStructure.tdsApplicable) {
      breakdown.TDS = 0; // TODO: Implement TDS calculation
      total += breakdown.TDS;
    }

    return {
      breakdown,
      total,
      detail: {
        note: 'Part-time professional: No PF/ESI/PT as per engagement terms',
      },
    };
  }

  /**
   * DEDUCTIONS CALCULATOR (Hourly)
   */
  private async calculateHourlyDeductions(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    earnings: any,
    workData: any,
  ): Promise<any> {
    const breakdown: any = {};
    let total = 0;

    // Hourly: Generally no statutory deductions
    // Only TDS if applicable
    if (salaryStructure.tdsApplicable) {
      breakdown.TDS = 0; // TODO: Implement TDS calculation
      total += breakdown.TDS;
    }

    return {
      breakdown,
      total,
      detail: {
        note: 'Hourly worker: Minimal statutory deductions',
      },
    };
  }

  /**
   * Calculate Professional Tax (Tamil Nadu)
   */
  private calculateProfessionalTax(grossSalary: number): number {
    // Tamil Nadu Professional Tax
    if (grossSalary > 10000) {
      return 200; // ₹200/month for gross > ₹10,000
    }
    return 0;
  }

  /**
   * EMPLOYER CONTRIBUTIONS
   */
  private async calculateEmployerContributions(
    manager: EntityManager,
    salaryStructure: EmployeeSalaryStructure,
    earnings: any,
  ): Promise<any> {
    const contributions: any = {};

    if (salaryStructure.pfApplicable) {
      const basic = Number(salaryStructure.salaryComponents.BASIC || 0);
      contributions.PF_EMPLOYER = Math.round(basic * (salaryStructure.pfEmployerPercentage / 100));
    }

    if (salaryStructure.esiApplicable && Number(earnings.gross) < 21000) {
      contributions.ESI_EMPLOYER = Math.round(
        Number(earnings.gross) * (salaryStructure.esiEmployerPercentage / 100),
      );
    }

    return contributions;
  }

  /**
   * WORK DATA GATHERER (Flexible)
   */
  private async getWorkData(
    manager: EntityManager,
    userId: number,
    year: number,
    month: number,
    employmentType: string,
  ): Promise<any> {
    // Get KPI score
    const kpiScore = await manager.findOne(MonthlyKpiScore, {
      where: {
        userId,
        year,
        month,
        active: true,
      },
    });

    if (employmentType === 'FULLTIME') {
      return this.calculateFullTimeWorkData(userId, year, month, manager, kpiScore);
    } else if (employmentType === 'PARTTIME') {
      return this.calculatePartTimeWorkData(userId, year, month, manager, kpiScore);
    } else if (employmentType === 'HOURLY') {
      return this.calculateHourlyWorkData(userId, year, month, manager, kpiScore);
    }

    throw new Error(`Unsupported employment type: ${employmentType}`);
  }

  /**
   * Calculate full-time work data
   */
  private async calculateFullTimeWorkData(
    userId: number,
    year: number,
    month: number,
    manager: EntityManager,
    kpiScore: MonthlyKpiScore | null,
  ): Promise<any> {
    const totalWorkingDays = this.getWorkingDays(year, month);

    // TODO: Get actual attendance records
    // For now, return sample data
    const presentDays = 26;
    const paidLeaveDays = 0;
    const lwpDays = 0;

    return {
      totalWorkingDays,
      actualDaysWorked: presentDays,
      presentDays: presentDays + paidLeaveDays,
      paidLeaveDays,
      lwpDays,
      kpiScore: kpiScore?.totalScore || 0,
      kpiBreakdown: kpiScore?.categoryScores || {},
      year,
      month,
    };
  }

  /**
   * Calculate part-time work data
   */
  private async calculatePartTimeWorkData(
    userId: number,
    year: number,
    month: number,
    manager: EntityManager,
    kpiScore: MonthlyKpiScore | null,
  ): Promise<any> {
    // TODO: Get actual attendance records
    // For now, return sample data
    const actualDaysWorked = 12; // Example: worked 12 days

    return {
      actualDaysWorked,
      kpiScore: kpiScore?.totalScore || 0,
      kpiBreakdown: kpiScore?.categoryScores || {},
      year,
      month,
    };
  }

  /**
   * Calculate hourly work data
   */
  private async calculateHourlyWorkData(
    userId: number,
    year: number,
    month: number,
    manager: EntityManager,
    kpiScore: MonthlyKpiScore | null,
  ): Promise<any> {
    // TODO: Get actual attendance records with hours
    const hoursWorked = 160; // Example: 160 hours

    return {
      hoursWorked,
      kpiScore: kpiScore?.totalScore || 0,
      kpiBreakdown: kpiScore?.categoryScores || {},
      year,
      month,
    };
  }

  /**
   * Get working days in a month
   */
  private getWorkingDays(year: number, month: number): number {
    // Simple implementation - could be enhanced to exclude holidays
    const daysInMonth = new Date(year, month, 0).getDate();
    return 26; // Standard working days per month
  }
}
