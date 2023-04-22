import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PurchaseService } from './purchase.service';
import { CreatePurchaseOrderDto } from './dto/create-order.dto';
import { User } from 'src/core/decorator/user.decorator';
import { UpdatePurchaseOrderDto } from './dto/update-order.dto';

@ApiTags('PurchaseOrders')
@Controller('purchaseorders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class PurchaseOrderController {

  constructor(private service:PurchaseService){}

  @Get('/:id')
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

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto:UpdatePurchaseOrderDto, @User() currentUser: any) {
    return this.service.updateOrder(id, updateDto, currentUser.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @User() currentUser: any) {
    return this.service.updateOrder(id, {isActive:false}, currentUser.id);
  }
}