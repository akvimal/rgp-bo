import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';
import { ApproveEnrollmentDto } from './dto/approve-enrollment.dto';

@ApiTags('Benefit Enrollments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('hr/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Enroll in a benefit' })
  @ApiResponse({ status: 201, description: 'Enrolled successfully' })
  @ApiResponse({ status: 404, description: 'Benefit policy not found' })
  @ApiResponse({ status: 409, description: 'Already enrolled' })
  async enrollInBenefit(@Body() createDto: CreateEnrollmentDto, @User() user: any) {
    return await this.enrollmentsService.enrollInBenefit(createDto, user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my enrollments' })
  @ApiResponse({ status: 200, description: 'Enrollments retrieved successfully' })
  async getMyEnrollments(@User() user: any) {
    return await this.enrollmentsService.getMyEnrollments(user.id);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all enrollments (admin)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'benefitPolicyId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'All enrollments retrieved successfully' })
  async getAllEnrollments(
    @Query('status') status?: string,
    @Query('benefitPolicyId') benefitPolicyId?: string,
  ) {
    const filters = {
      status,
      benefitPolicyId: benefitPolicyId ? parseInt(benefitPolicyId) : undefined,
    };
    return await this.enrollmentsService.getAllEnrollments(filters);
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available benefits for enrollment' })
  @ApiResponse({ status: 200, description: 'Available benefits retrieved successfully' })
  async getAvailableBenefits(@User() user: any) {
    return await this.enrollmentsService.getAvailableBenefits(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get enrollment by ID' })
  @ApiResponse({ status: 200, description: 'Enrollment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async getEnrollmentById(@Param('id', ParseIntPipe) id: number) {
    return await this.enrollmentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment updated successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async updateEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateEnrollmentDto,
    @User() user: any,
  ) {
    return await this.enrollmentsService.updateEnrollment(id, updateDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel enrollment' })
  @ApiResponse({ status: 204, description: 'Enrollment cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async cancelEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason: string,
    @User() user: any,
  ) {
    await this.enrollmentsService.cancelEnrollment(id, reason, user.id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve or reject enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid enrollment status' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async approveEnrollment(
    @Param('id', ParseIntPipe) id: number,
    @Body() approveDto: ApproveEnrollmentDto,
    @User() user: any,
  ) {
    return await this.enrollmentsService.approveEnrollment(id, approveDto, user.id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk enroll users in benefit' })
  @ApiResponse({ status: 201, description: 'Bulk enrollment completed' })
  async bulkEnrollUsers(@Body() bulkDto: BulkEnrollmentDto, @User() user: any) {
    return await this.enrollmentsService.bulkEnrollUsers(bulkDto, user.id);
  }
}
