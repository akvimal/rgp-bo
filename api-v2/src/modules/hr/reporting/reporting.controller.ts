import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';

@Controller('hr/reports')
@UseGuards(AuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('attendance')
  generateAttendanceReport(
    @Query('storeId', ParseIntPipe) storeId: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.reportingService.generateAttendanceReport(storeId, year, month);
  }

  @Get('leave')
  generateLeaveReport(
    @Query('storeId', ParseIntPipe) storeId: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.reportingService.generateLeaveReport(storeId, year);
  }

  @Get('performance')
  generatePerformanceReport(
    @Query('storeId', ParseIntPipe) storeId: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.reportingService.generatePerformanceReport(storeId, year, month);
  }

  @Get('dashboard/my')
  getMyDashboard(@User() user: any) {
    return this.reportingService.getUserDashboard(user.id);
  }

  @Get('dashboard/user/:userId')
  getUserDashboard(@Query('userId', ParseIntPipe) userId: number) {
    return this.reportingService.getUserDashboard(userId);
  }
}
