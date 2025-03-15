import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { CustomerService } from "../customers/customer.service";
import { SaleDeliveryService } from "./sale-delivery.service";
import { CreateSaleDeliveryDto } from "./dto/create-saledelivery.dto";

@ApiTags('Deliveries')
@Controller('deliveries')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SaleDeliveryController {

    constructor(private service:SaleDeliveryService, 
      private custService:CustomerService){}

      @Post()
      async create(@Body() dto: CreateSaleDeliveryDto, @User() currentUser: any) {
        return this.service.save(dto, currentUser.id);
      }

    @Get()
    async findAll(@Query() query: any, @User() currentUser: any) {
      return this.service.findAll(query,query['self']==='true'?currentUser.id:null);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.service.delete(id);
    }
    
}