import { SaleService } from "./sale.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { CreateSaleItemDto } from "./dto/create-saleitem.dto";
import { AuthGuard } from "@nestjs/passport";
import { User } from "../../core/decorator/user.decorator";
import { CustomerService } from "../customers/customer.service";
import { CreateSaleReturnItemDto } from "./dto/create-salereturnitem.dto";
import { UpdateSaleReturnItemDto } from "./dto/update-salereturnitem.dto";

@ApiTags('Sales')
@Controller('sales')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class SaleController {

    constructor(private saleService:SaleService, 
      private custService:CustomerService){}

      @Post()
      async create(@Body() createSaleDto: CreateSaleDto, @User() currentUser: any) {

        let customer = createSaleDto.customer;
        if(customer){ //if customer not present before
          customer = await this.custService.save(createSaleDto.customer);
        }
        
        return this.saleService.create({...createSaleDto, customer}, currentUser.id);
      }

      @Put()
      async update(@Body() updateSaleDto: any, @User() currentUser: any) {
        //get the itemid that is removed at client end
        const sale = await this.saleService.findById(updateSaleDto.id);
        const existingItemIds = sale.items.map(i => i.id);
        const newIntemIds = updateSaleDto['items'].map(i => i.id);
        const removedItemIds = existingItemIds.filter(num => !newIntemIds.includes(num));        
        if(removedItemIds.length > 0 ){
          await this.saleService.removeItemsByIds(removedItemIds);
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

    @Post('/returns')
    async returnItem(@Body() items:CreateSaleReturnItemDto[], @User() currentUser: any) {
      return this.saleService.createReturnItems(items, currentUser.id);
    } 
    
    @Put('/returns')
    async updateReturnItem(@Body() item:UpdateSaleReturnItemDto, @User() currentUser: any) {
      return this.saleService.updateReturnItem(item, currentUser.id);
    }

    @Get('/raw')
    async findAllSales() {
      return this.saleService.getSales();
    }

    @Get('/returns/:id/eligible')
    async getEligibleReturns(@Param('id') id: number) {
      const items = await this.saleService.getEligibleReturns(id);
      const sale = await this.saleService.findById(id);
      return {...sale, items};
    }
    
    @Get('/returns/items/:rid')
    async getReturnItemToAdjust(@Param('rid') rid: number) {
      return await this.saleService.getReturnItemToAdjust(rid);
    }

    @Get('/returns/:id/sale')
    async getSaleReturnItems(@Param('id') id: number) {
      return await this.saleService.getSaleReturnItems(id);
    }

    @Get('/visits/:days')
    async findDaysVisited(@Param('days') days: number) {
      return this.saleService.findVisits({maxdays:days})
    }
    
    @Get('/returns')
    async findAllReturns() {
      return this.saleService.getReturns();
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
      return this.saleService.findAll(query,query['self']==='true'?currentUser.id:null);
    }

    @Get('/saved')
    async findAllSaved() {
      return this.saleService.findSavedSales();
    }

    @Post('/items/criteria')
    async findAllItems(@Body() criteria: any, @User() currentUser: any) {
      return this.saleService.findAllItems(criteria,undefined);
    }

    @Get('/:id')
    async findById(@Param('id') id: number) {
      const sale = await this.saleService.findById(id);
      return sale;//this.stockService.getItemsWithStockData(sale);
    }

    @Get('/:id/availableitems')
    async findSaleItemsForSaleWithAvailableQty(@Param('id') id: number) {
      return await this.saleService.findSaleItemsForSaleWithAvailableQty(id)
    }
    
    // @Get('/:id/:year/:month/customer')
    // async findCustomerSaleByPeriod(@Param('id') custid: string,
    //     @Param('year') year: number,
    //     @Param('month') month: number) {
    //   return await this.saleService.findCustomerSaleByPeriod(custid,year,month);
    // }   
    
    // @Get('/:id/customer/months')
    // async findCustomerSaleMonths(@Param('id') custid: string) {
    //   return await this.saleService.findCustomerSaleMonths(custid);
    // }

    @Get('/:id/items')
    async findAllItemsBySale(@Param('id') id: string) {
      return this.saleService.findAllItemsBySale(id);
    }
    
    @Get('/:id/items/return')
    async findAllItemsToReturn(@Param('id') id: string) {
      return this.saleService.findAllEligibleItemsToReturn(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.saleService.delete(id);
    }
    
    @Delete('items/:id')
    removeItem(@Param('id') id: string, @User() currentUser: any) {
      return this.saleService.removeItem(id, currentUser.id);
    }

    @Delete('returns/:id')
    removeReturnItem(@Param('id') id: string) {
      return this.saleService.removeReturnItem(id);
    }
}