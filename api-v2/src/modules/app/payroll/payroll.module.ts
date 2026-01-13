import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { PayrollController } from './payroll.controller';
import { MigrationController } from './migration.controller';
import { PayrollRunService } from './services/payroll-run.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { AuthModule } from '../../auth/auth.module';

// Entities
import { PayrollRun } from '../../../entities/payroll-run.entity';
import { PayrollDetail } from '../../../entities/payroll-detail.entity';
import { EmployeeSalaryStructure } from '../../../entities/employee-salary-structure.entity';
import { EmploymentTypeMaster } from '../../../entities/employment-type-master.entity';
import { RoleMaster } from '../../../entities/role-master.entity';
import { MonthlyKpiScore } from '../../../entities/monthly-kpi-score.entity';
import { AppUser } from '../../../entities/appuser.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollRun,
      PayrollDetail,
      EmployeeSalaryStructure,
      EmploymentTypeMaster,
      RoleMaster,
      MonthlyKpiScore,
      AppUser,
    ]),
    AuthModule,
  ],
  controllers: [PayrollController, MigrationController],
  providers: [PayrollRunService, PayrollCalculationService, JwtService],
  exports: [PayrollRunService, PayrollCalculationService],
})
export class PayrollModule {}
