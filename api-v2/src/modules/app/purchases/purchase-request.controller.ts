import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchaseService } from './purchase.service';
import { CreatePurchaseRequestDto } from './dto/create-request.dto';
import { User } from 'src/core/decorator/user.decorator';
import { UpdatePurchaseRequestDto } from './dto/update-request.dto';

@ApiTags('PurchaseRequests')
@Controller('purchaserequests')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PurchaseRequestController {

    constructor(private service:PurchaseService){}

    @Get('/:id')
    async findById(@Param('id') id: number) {
      return this.service.findRequestById(id);
    }

    @Get()
    async findAll(@Query() query: any) {
        return this.service.findAllRequests(query);
    }

    @Post('/filter')
    async filter(@Body() criteria: any) {
      return this.service.findAllRequestsByCriteria(criteria);
    }

    @Post()
    async create(@Body() createDto: CreatePurchaseRequestDto,  @User() currentUser: any) {
        return this.service.createRequest(createDto, currentUser.id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto:UpdatePurchaseRequestDto, @User() currentUser: any) {
      return this.service.updateRequest(id, updateDto, currentUser.id);
    }
    
    @Put(':id/remove')
    removeOrder(@Param('id') id: string, @User() currentUser: any) {
      return this.service.removeOrder(id, currentUser.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.service.updateRequest(id, {isActive:false}, currentUser.id);
    }
}