import { SaleService } from "./sale.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { AuthGuard } from "@nestjs/passport";
import { User } from "src/core/decorator/user.decorator";
import { CustomerService } from "../customers/customer.service";
import { StockService } from "../stock/stock.service";
import { RoleService } from "../app/roles/role.service";
import { UpdateSaleDto } from "./dto/update-sale.dto";

@ApiTags('Sales')
@Controller('sales')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class SaleController {

    constructor(private saleService:SaleService, 
      private stockService:StockService, 
      private custService:CustomerService,
      private roleService:RoleService){}

      @Post()
      async create(@Body() createSaleDto: CreateSaleDto, @User() currentUser: any) {
          
          if(createSaleDto.id ){
            await this.saleService.removeItems(createSaleDto.id);
          }
          
            let customer = createSaleDto.customer;
            if(customer){ //if customer not present before
              customer = await this.custService.save(createSaleDto.customer);
            }
            
            return this.saleService.create({...createSaleDto, customer}, currentUser.id);
      }

      @Put()
      async update(@Body() updateSaleDto: UpdateSaleDto, @User() currentUser: any) {
        if(updateSaleDto.id ){
          await this.saleService.removeItems(updateSaleDto.id);
        }
        let customer = updateSaleDto.customer;
        if(customer){ //if customer not present before
          customer = await this.custService.save(updateSaleDto.customer);
        }
        return this.saleService.updateSale({...updateSaleDto, customer}, currentUser.id);
      }

    @Post('/items')
    async createItem(@Body() createSaleItemDto: CreateSaleItemDto, @User() currentUser: any) {
        return this.saleService.createItem(createSaleItemDto, currentUser.id);
    }

    @Get('/raw')
    async findAllSales() {
      return this.saleService.getSales();
    }

    @Post('/data')
    async getSalesByFreq(@Body() criteria: any) {
      return this.saleService.getSalesByFreq(criteria.fromdate,criteria.freq,criteria.count);
    }

    @Post('/visits')
    async getCustomerByFreq(@Body() criteria: any) {
      return this.saleService.getCustomerVisitByFreq(criteria.fromdate,criteria.freq,criteria.count);
    }

    @Get()
    async findAll(@Query() query: any, @User() currentUser: any) {
      
      const role = await this.roleService.findById(currentUser.roleid);
      const sale = Object.values(role.permissions).find((p:any) => p.resource === 'sales');
      const owned = (!sale.data || sale.data === 'self') ? currentUser.id : undefined;
      return this.saleService.findAll(query,owned);
    }

    @Post('/items/criteria')
    async findAllItems(@Body() criteria: any, @User() currentUser: any) {
            
      const role = await this.roleService.findById(currentUser.roleid);
      const sale = Object.values(role.permissions).find((p:any) => p.resource === 'sales');
      const owned = (!sale.data || sale.data === 'self') ? currentUser.id : undefined;

      return this.saleService.findAllItems(criteria,owned);
    }

    @Get('/:id')
    async findById(@Param('id') id: string) {
      const sale = await this.saleService.findById(id);
      return sale;//this.stockService.getItemsWithStockData(sale);
    }

    @Get('/:id/availableitems')
    async findSaleItemsForSaleWithAvailableQty(@Param('id') id: number) {
      return await this.saleService.findSaleItemsForSaleWithAvailableQty(id)
    }
    
    @Get('/:id/customer')
    async findItems(@Param('id') custid: string) {

      // const stocks = await this.stockService.findAll(); //for finding item available qty
      const sales = await this.saleService.findAllByCustomerId(custid,3);
      
      // sales.forEach(s => {
      //   s.items.forEach((i:any) => {
      //     const st = stocks.find(s => s.id === i.itemid);
      //     i.maxqty = st.available_qty; //add max qty possible
      //   });
      // })      
      
      return sales;
    }

    @Get('/:id/items')
    async findAllItemsBySale(@Param('id') id: string) {
      return this.saleService.findAllItemsBySale(id);
    }
    
    @Get('/:id/items/return')
    async findAllItemsToReturn(@Param('id') id: string) {
      return this.saleService.findAllEligibleItemsToReturn(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.saleService.update(id, {isActive:false}, currentUser.id);
    }
    
    @Delete('items/:id')
    removeItem(@Param('id') id: string, @User() currentUser: any) {
      return this.saleService.removeItem(id, currentUser.id);
    }
}