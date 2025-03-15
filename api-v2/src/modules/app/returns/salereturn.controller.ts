import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateSaleReturnDto } from "./dto/create-salereturn.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { SaleItemService } from "./saleitem.service";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturn.dto";
import { CreateProductClearanceDto } from './dto/create-clearance.dto';
import { RoleService } from '../roles/role.service';
import { User } from 'src/core/decorator/user.decorator';
@ApiTags('SaleReturns')
@Controller('salereturns')
@ApiBearerAuth()
@UseGuards(AuthGuard)
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
      if(!role){
        throw new NotFoundException('Role not found');
      }
      if (!role.permissions) {
        throw new NotFoundException('Role permissions not found');
      }
      const permission = Object.values(role.permissions as Record<string, any>).find((p:any) => p.resource === 'returns');
      const owned = (!permission?.data || permission.data === 'self') ? currentUser.id : undefined;

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