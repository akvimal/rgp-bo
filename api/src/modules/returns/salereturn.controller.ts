import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateSaleReturnDto } from "./dto/create-salereturn.dto";
import { AuthGuard } from "@nestjs/passport";
import { User } from "src/core/decorator/user.decorator";
import { RoleService } from "../app/roles/role.service";
import { SaleItemService } from "./saleitem.service";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturn.dto";
import { CreateProductClearanceDto } from './dto/create-clearance.dto';

@ApiTags('SaleReturns')
@Controller('salereturns')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class SaleReturnController {

    constructor(private saleItemService:SaleItemService, 
      private roleService:RoleService){}

    @Post()
    async create(@Body() createSaleReturnDto: CreateSaleReturnDto, @User() currentUser: any) {
      return this.saleItemService.saveReturn(createSaleReturnDto, currentUser.id);
    }

    @Post('/clearance')
    async createClearance(@Body() createClearanceDto: CreateProductClearanceDto, @User() currentUser: any) {
      return this.saleItemService.saveClearance(createClearanceDto, currentUser.id);
    }

    @Get()
    async findAll(@Query() query: any, @User() currentUser: any) {
      
      const role = await this.roleService.findById(currentUser.roleid);
      const permission = Object.values(role.permissions).find((p:any) => p.resource === 'returns');
      const owned = (!permission.data || permission.data === 'self') ? currentUser.id : undefined;

      return this.saleItemService.findAllReturns(query,owned);
    }

    @Get('/:id')
    async findById(@Param('id') id: number) {
      return await this.saleItemService.findById(id);
    }

    @Post('/customers')
    async findCustomersWithSales(@Body() criteria: any) {
      return await this.saleItemService.findCustomers(criteria);
    }

    @Post('/products')
    async findProductsWithCustomerSales(@Body() criteria: any) {
      return await this.saleItemService.findCustomerItems(criteria);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.saleItemService.remove(id, currentUser.id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateSaleReturnItemDto, @User() currentUser: any) {
      return this.saleItemService.update(id, dto, currentUser.id);
    }
    
}