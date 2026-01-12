import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttendanceService } from './attendance.service';
import { ClockInDto } from '../dto/attendance/clock-in.dto';
import { ClockOutDto } from '../dto/attendance/clock-out.dto';
import { UpdateAttendanceDto } from '../dto/attendance/update-attendance.dto';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';

@Controller('hr/attendance')
@UseGuards(AuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpg|jpeg|png)$/)) {
          return cb(new Error('Only JPG, JPEG, and PNG images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  clockIn(
    @Body() clockInDto: ClockInDto,
    @UploadedFile() photo: Express.Multer.File,
    @User() user: any,
  ) {
    return this.attendanceService.clockIn(user.id, clockInDto, photo);
  }

  @Post('clock-out')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpg|jpeg|png)$/)) {
          return cb(new Error('Only JPG, JPEG, and PNG images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  clockOut(
    @Body() clockOutDto: ClockOutDto,
    @UploadedFile() photo: Express.Multer.File,
    @User() user: any,
  ) {
    return this.attendanceService.clockOut(user.id, clockOutDto, photo);
  }

  @Get('today')
  getTodayAttendance(@User() user: any) {
    const today = new Date().toISOString().split('T')[0];
    return this.attendanceService.getByUserAndDate(user.id, today);
  }

  @Get('date/:date')
  getByDate(@Param('date') date: string, @User() user: any) {
    return this.attendanceService.getByUserAndDate(user.id, date);
  }

  @Get('monthly')
  getMonthly(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
    @User() user: any,
  ) {
    return this.attendanceService.getMonthlyAttendance(user.id, year, month);
  }

  @Get('user/:userId/monthly')
  getUserMonthly(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.attendanceService.getMonthlyAttendance(userId, year, month);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAttendanceDto,
    @User() user: any,
  ) {
    return this.attendanceService.update(id, updateDto, user.id);
  }
}
