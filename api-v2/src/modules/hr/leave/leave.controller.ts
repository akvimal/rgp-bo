import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from '../dto/leave/create-leave-request.dto';
import { ApproveLeaveDto } from '../dto/leave/approve-leave.dto';
import { LeaveBalanceQueryDto } from '../dto/leave/leave-balance-query.dto';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';
import { LeaveRequestStatus } from '../../../entities/leave-request.entity';

@Controller('hr/leave')
@UseGuards(AuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('types')
  getLeaveTypes() {
    return this.leaveService.getLeaveTypes();
  }

  @Post('request')
  createRequest(@Body() createDto: CreateLeaveRequestDto, @User() user: any) {
    return this.leaveService.createRequest(user.id, createDto);
  }

  @Patch('request/:id/approve')
  approveLeave(
    @Param('id', ParseIntPipe) id: number,
    @Body() approveDto: ApproveLeaveDto,
    @User() user: any,
  ) {
    return this.leaveService.approveLeave(id, approveDto, user.id);
  }

  @Get('requests/pending')
  getPendingRequests() {
    return this.leaveService.getPendingRequests();
  }

  @Get('requests/my')
  getMyRequests(@User() user: any, @Query('status') status?: LeaveRequestStatus) {
    return this.leaveService.getUserRequests(user.id, status);
  }

  @Get('requests/user/:userId')
  getUserRequests(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('status') status?: LeaveRequestStatus,
  ) {
    return this.leaveService.getUserRequests(userId, status);
  }

  @Get('balance/my')
  getMyBalance(@User() user: any, @Query() queryDto: LeaveBalanceQueryDto) {
    return this.leaveService.getUserBalance(user.id, queryDto);
  }

  @Get('balance/user/:userId')
  getUserBalance(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() queryDto: LeaveBalanceQueryDto,
  ) {
    return this.leaveService.getUserBalance(userId, queryDto);
  }

  @Post('balance/initialize/:userId')
  initializeBalances(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.leaveService.initializeYearlyBalances(userId, year);
  }
}
