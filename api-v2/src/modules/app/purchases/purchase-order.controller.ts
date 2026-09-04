import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchaseService } from './purchase.service';
import { CreatePurchaseOrderDto } from './dto/create-order.dto';
import { User } from 'src/core/decorator/user.decorator';
import { UpdatePurchaseOrderDto } from './dto/update-order.dto';

@ApiTags('PurchaseOrders')
@Controller('purchaseorders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
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

  @Post(':id/submit')
  submit(@Param('id') id: string, @User() currentUser: any) {
    return this.service.submitOrder(+id, currentUser.id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @User() currentUser: any) {
    if(!(await this.service.canApproveOrder(currentUser.roleid))){
      throw new ForbiddenException('You are not allowed to approve purchase orders');
    }
    return this.service.approveOrder(+id, currentUser.id);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body: any, @User() currentUser: any) {
    if(!(await this.service.canApproveOrder(currentUser.roleid))){
      throw new ForbiddenException('You are not allowed to reject purchase orders');
    }
    return this.service.rejectOrder(+id, body?.reason || '', currentUser.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @User() currentUser: any) {
    const order = await this.service.findOrderById(id);
    if (order && order.status && order.status !== 'PENDING') {
      throw new BadRequestException(`Only a draft (PENDING) purchase order can be deleted; this one is ${order.status}.`);
    }
    return this.service.updateOrder(id, {isActive:false}, currentUser.id);
  }
}
