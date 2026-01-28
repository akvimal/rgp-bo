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
import { PoliciesService } from './policies.service';
import { CreateHrPolicyDto } from './dto/create-hr-policy.dto';
import { UpdateHrPolicyDto } from './dto/update-hr-policy.dto';
import { AcknowledgePolicyDto } from './dto/acknowledge-policy.dto';

@ApiTags('HR Policies')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('hr/policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all HR policies' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by policy category' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'mandatory', required: false, type: Boolean, description: 'Filter by mandatory status' })
  @ApiResponse({ status: 200, description: 'List of HR policies retrieved successfully' })
  async findAll(
    @Query('category') category?: string,
    @Query('active') active?: string,
    @Query('mandatory') mandatory?: string,
  ) {
    const filters = {
      category,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      mandatory: mandatory === 'true' ? true : mandatory === 'false' ? false : undefined,
    };
    return await this.policiesService.findAll(filters);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my applicable policies' })
  @ApiResponse({ status: 200, description: 'User policies retrieved successfully' })
  async getMyPolicies(@User() user: any) {
    return await this.policiesService.getMyPolicies(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get policy by ID' })
  @ApiResponse({ status: 200, description: 'Policy retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.policiesService.findOne(id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get policy by code' })
  @ApiResponse({ status: 200, description: 'Policy retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async findByCode(@Param('code') code: string) {
    return await this.policiesService.findByCode(code);
  }

  @Get(':id/acknowledgments')
  @ApiOperation({ summary: 'Get policy acknowledgments' })
  @ApiResponse({ status: 200, description: 'Acknowledgments retrieved successfully' })
  async getPolicyAcknowledgments(@Param('id', ParseIntPipe) id: number) {
    return await this.policiesService.getPolicyAcknowledgments(id);
  }

  @Get('history/:code')
  @ApiOperation({ summary: 'Get policy version history' })
  @ApiResponse({ status: 200, description: 'Policy history retrieved successfully' })
  async getPolicyHistory(@Param('code') code: string) {
    return await this.policiesService.getPolicyHistory(code);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new HR policy' })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Policy code already exists' })
  async create(@Body() createDto: CreateHrPolicyDto, @User() user: any) {
    return await this.policiesService.create(createDto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an HR policy' })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @ApiResponse({ status: 409, description: 'Policy code already exists' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateHrPolicyDto,
    @User() user: any,
  ) {
    return await this.policiesService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive an HR policy' })
  @ApiResponse({ status: 204, description: 'Policy archived successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async archive(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    await this.policiesService.archive(id, user.id);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a policy' })
  @ApiResponse({ status: 201, description: 'Policy acknowledged successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @ApiResponse({ status: 409, description: 'Policy already acknowledged' })
  async acknowledgePolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body() acknowledgeDto: AcknowledgePolicyDto,
    @User() user: any,
  ) {
    return await this.policiesService.acknowledgePolicy(id, acknowledgeDto, user.id);
  }
}
