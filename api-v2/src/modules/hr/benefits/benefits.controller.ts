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
import { BenefitsService } from './benefits.service';
import { CreateBenefitMasterDto } from './dto/create-benefit-master.dto';
import { CreateBenefitPolicyDto, UpdateBenefitPolicyDto } from './dto/create-benefit-policy.dto';

@ApiTags('Benefits')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('hr/benefits')
export class BenefitsController {
  constructor(private readonly benefitsService: BenefitsService) {}

  // ===================================
  // BENEFIT MASTERS (Types)
  // ===================================

  @Get('master')
  @ApiOperation({ summary: 'Get all benefit types' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by benefit category' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'List of benefit types retrieved successfully' })
  async findAllMasters(
    @Query('category') category?: string,
    @Query('active') active?: string,
  ) {
    const filters = {
      category,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
    };
    return await this.benefitsService.findAllMasters(filters);
  }

  @Get('master/:id')
  @ApiOperation({ summary: 'Get benefit master by ID' })
  @ApiResponse({ status: 200, description: 'Benefit master retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Benefit master not found' })
  async findMasterById(@Param('id', ParseIntPipe) id: number) {
    return await this.benefitsService.findMasterById(id);
  }

  @Post('master')
  @ApiOperation({ summary: 'Create a new benefit type' })
  @ApiResponse({ status: 201, description: 'Benefit type created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Benefit code already exists' })
  async createBenefitMaster(
    @Body() createDto: CreateBenefitMasterDto,
    @User() user: any,
  ) {
    return await this.benefitsService.createBenefitMaster(createDto, user.id);
  }

  // ===================================
  // BENEFIT POLICIES
  // ===================================

  @Get('policies')
  @ApiOperation({ summary: 'Get all benefit policies' })
  @ApiQuery({ name: 'benefitId', required: false, type: Number, description: 'Filter by benefit type ID' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'List of benefit policies retrieved successfully' })
  async findAllPolicies(
    @Query('benefitId') benefitId?: string,
    @Query('active') active?: string,
  ) {
    const filters = {
      benefitId: benefitId ? parseInt(benefitId) : undefined,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
    };
    return await this.benefitsService.findAllPolicies(filters);
  }

  @Get('policies/:id')
  @ApiOperation({ summary: 'Get benefit policy by ID' })
  @ApiResponse({ status: 200, description: 'Benefit policy retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Benefit policy not found' })
  async findPolicyById(@Param('id', ParseIntPipe) id: number) {
    return await this.benefitsService.findPolicyById(id);
  }

  @Post('policies')
  @ApiOperation({ summary: 'Create a new benefit policy' })
  @ApiResponse({ status: 201, description: 'Benefit policy created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Benefit master not found' })
  async createBenefitPolicy(
    @Body() createDto: CreateBenefitPolicyDto,
    @User() user: any,
  ) {
    return await this.benefitsService.createBenefitPolicy(createDto, user.id);
  }

  @Patch('policies/:id')
  @ApiOperation({ summary: 'Update a benefit policy' })
  @ApiResponse({ status: 200, description: 'Benefit policy updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Benefit policy not found' })
  async updateBenefitPolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateBenefitPolicyDto,
    @User() user: any,
  ) {
    return await this.benefitsService.updateBenefitPolicy(id, updateDto, user.id);
  }

  @Delete('policies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a benefit policy' })
  @ApiResponse({ status: 204, description: 'Benefit policy archived successfully' })
  @ApiResponse({ status: 404, description: 'Benefit policy not found' })
  async archiveBenefitPolicy(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    await this.benefitsService.archiveBenefitPolicy(id, user.id);
  }

  // ===================================
  // USER BENEFITS
  // ===================================

  @Get('my')
  @ApiOperation({ summary: 'Get my enrolled benefits' })
  @ApiResponse({ status: 200, description: 'User benefits retrieved successfully' })
  async getMyBenefits(@User() user: any) {
    return await this.benefitsService.getMyBenefits(user.id);
  }

  @Get('eligible')
  @ApiOperation({ summary: 'Get benefits I am eligible for' })
  @ApiResponse({ status: 200, description: 'Eligible benefits retrieved successfully' })
  async getEligibleBenefits(@User() user: any) {
    return await this.benefitsService.getEligibleBenefits(user.id);
  }

  @Get('calculate/:policyId')
  @ApiOperation({ summary: 'Calculate benefit amount for user' })
  @ApiQuery({ name: 'salary', required: false, type: Number, description: 'User salary for percentage calculations' })
  @ApiResponse({ status: 200, description: 'Benefit amount calculated successfully' })
  @ApiResponse({ status: 404, description: 'Benefit policy not found' })
  async calculateBenefitAmount(
    @Param('policyId', ParseIntPipe) policyId: number,
    @Query('salary') salary?: string,
    @User() user?: any,
  ) {
    const userSalary = salary ? parseFloat(salary) : undefined;
    return await this.benefitsService.calculateBenefitAmount(policyId, user.id, userSalary);
  }
}
