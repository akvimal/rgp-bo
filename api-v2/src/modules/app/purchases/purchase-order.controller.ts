import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchaseService } from './purchase.service';
import { CreatePurchaseOrderDto } from './dto/create-order.dto';
import { User } from 'src/core/decorator/user.decorator';
import { UpdatePurchaseOrderDto } from './dto/update-order.dto';
import { CreatePurchaseOrderFromIntentsDto } from './dto/create-order-from-intents.dto';
import { CreatePurchaseOrderWithItemsDto } from './dto/create-order-with-items.dto';
import { POSuggestionsResponseDto } from './dto/po-suggestion.dto';

@ApiTags('PurchaseOrders')
@Controller('purchaseorders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PurchaseOrderController {

  constructor(private service:PurchaseService){}

  @Get('suggestions')
  @ApiOperation({ summary: 'Get smart PO suggestions for a store (low stock + sales intents)' })
  @ApiQuery({ name: 'storeId', required: true, type: Number, description: 'Store ID to get suggestions for' })
  async getSmartSuggestions(@Query('storeId') storeId: string): Promise<POSuggestionsResponseDto> {
    return this.service.getSmartPOSuggestions(parseInt(storeId, 10));
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findOrderById(id);
  }

  @Get()
  async findAll(@Query() query: any) {
      return this.service.findAllOrders(query);
  }

  @Post('/filter')
  async filter(@Body() criteria: any) {
    return this.service.findAllOrdersByCriteria(criteria);
  }

  @Post()
  async create(@Body() createDto: CreatePurchaseOrderDto,  @User() currentUser: any) {
      return this.service.createOrder(createDto, currentUser.id);
  }

  @Post('/from-intents')
  async createFromIntents(@Body() createDto: CreatePurchaseOrderFromIntentsDto, @User() currentUser: any) {
      return this.service.createOrderFromIntents(createDto, currentUser.id);
  }

  @Post('/with-items')
  @ApiOperation({ summary: 'Create PO with items in one step' })
  async createWithItems(@Body() createDto: CreatePurchaseOrderWithItemsDto, @User() currentUser: any) {
      return this.service.createOrderWithItems(createDto, currentUser.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto:UpdatePurchaseOrderDto, @User() currentUser: any) {
    return this.service.updateOrder(id, updateDto, currentUser.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @User() currentUser: any) {
    return this.service.updateOrder(id, {isActive:false}, currentUser.id);
  }
}