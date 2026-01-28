import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';
import { ClaimsService } from './claims.service';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { ApproveClaimDto } from './dto/approve-claim.dto';
import { RejectClaimDto } from './dto/reject-claim.dto';
import { PayClaimDto } from './dto/pay-claim.dto';

@ApiTags('Benefit Claims')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('hr/claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new claim' })
  @ApiResponse({ status: 201, description: 'Claim submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim data' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async submitClaim(@Body() submitDto: SubmitClaimDto, @User() user: any) {
    return await this.claimsService.submitClaim(submitDto, user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my claims' })
  @ApiResponse({ status: 200, description: 'Claims retrieved successfully' })
  async getMyClaims(@User() user: any) {
    return await this.claimsService.getMyClaims(user.id);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending claims for review' })
  @ApiResponse({ status: 200, description: 'Pending claims retrieved successfully' })
  async getPendingClaims(@User() user: any) {
    return await this.claimsService.getPendingClaims(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiResponse({ status: 200, description: 'Claim retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async getClaimById(@Param('id', ParseIntPipe) id: number) {
    return await this.claimsService.getClaimById(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review a claim' })
  @ApiResponse({ status: 200, description: 'Claim reviewed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async reviewClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() reviewDto: ReviewClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.reviewClaim(id, reviewDto, user.id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a claim' })
  @ApiResponse({ status: 200, description: 'Claim approved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async approveClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() approveDto: ApproveClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.approveClaim(id, approveDto, user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a claim' })
  @ApiResponse({ status: 200, description: 'Claim rejected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async rejectClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() rejectDto: RejectClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.rejectClaim(id, rejectDto, user.id);
  }

  @Patch(':id/pay')
  @ApiOperation({ summary: 'Mark claim as paid' })
  @ApiResponse({ status: 200, description: 'Claim marked as paid successfully' })
  @ApiResponse({ status: 400, description: 'Invalid claim status' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async markAsPaid(
    @Param('id', ParseIntPipe) id: number,
    @Body() payDto: PayClaimDto,
    @User() user: any,
  ) {
    return await this.claimsService.markAsPaid(id, payDto, user.id);
  }
}
