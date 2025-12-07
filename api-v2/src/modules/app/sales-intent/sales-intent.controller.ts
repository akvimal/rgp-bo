import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { SalesIntentService } from './sales-intent.service';
import { CreateSalesIntentDto } from './dto/create-sales-intent.dto';
import { UpdateSalesIntentDto, UpdateFulfillmentDto } from './dto/update-sales-intent.dto';

@ApiTags('Sales Intent')
@Controller('sales-intent')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class SalesIntentController {
    constructor(private readonly salesIntentService: SalesIntentService) {}

    @Post()
    @ApiOperation({ summary: 'Create new sales intent' })
    @ApiResponse({ status: 201, description: 'Intent created successfully' })
    async create(@Body() dto: CreateSalesIntentDto, @User() currentUser: any) {
        return this.salesIntentService.create(dto, currentUser.id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all sales intents with optional filters' })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
    @ApiQuery({ name: 'intenttype', required: false, description: 'Filter by intent type' })
    @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority' })
    @ApiQuery({ name: 'customerid', required: false, description: 'Filter by customer ID' })
    @ApiQuery({ name: 'fulfillmentstatus', required: false, description: 'Filter by fulfillment status' })
    @ApiResponse({ status: 200, description: 'List of sales intents' })
    async findAll(@Query() filters: any) {
        return this.salesIntentService.findAll(filters);
    }

    @Get('pending-for-po')
    @ApiOperation({ summary: 'Get pending intents for PO generation' })
    @ApiResponse({ status: 200, description: 'List of pending intents' })
    async getPendingForPO() {
        return this.salesIntentService.getPendingForPO();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get sales intent by ID' })
    @ApiResponse({ status: 200, description: 'Sales intent details' })
    @ApiResponse({ status: 404, description: 'Intent not found' })
    async findOne(@Param('id') id: string) {
        return this.salesIntentService.findOne(parseInt(id));
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update sales intent' })
    @ApiResponse({ status: 200, description: 'Intent updated successfully' })
    @ApiResponse({ status: 404, description: 'Intent not found' })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateSalesIntentDto,
        @User() currentUser: any
    ) {
        return this.salesIntentService.update(parseInt(id), dto, currentUser.id);
    }

    @Put(':id/fulfillment')
    @ApiOperation({ summary: 'Update fulfillment status' })
    @ApiResponse({ status: 200, description: 'Fulfillment updated successfully' })
    async updateFulfillment(
        @Param('id') id: string,
        @Body() dto: UpdateFulfillmentDto,
        @User() currentUser: any
    ) {
        return this.salesIntentService.updateFulfillment(parseInt(id), dto, currentUser.id);
    }

    @Put(':id/cancel')
    @ApiOperation({ summary: 'Cancel sales intent' })
    @ApiResponse({ status: 200, description: 'Intent cancelled successfully' })
    async cancel(
        @Param('id') id: string,
        @Body() body: { reason?: string },
        @User() currentUser: any
    ) {
        return this.salesIntentService.cancel(parseInt(id), currentUser.id, body.reason);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete sales intent (soft delete)' })
    @ApiResponse({ status: 200, description: 'Intent deleted successfully' })
    @ApiResponse({ status: 400, description: 'Can only delete PENDING intents' })
    async delete(@Param('id') id: string, @User() currentUser: any) {
        await this.salesIntentService.delete(parseInt(id), currentUser.id);
        return { message: 'Intent deleted successfully' };
    }
}
