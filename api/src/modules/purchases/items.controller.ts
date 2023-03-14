import { PurchaseInvoiceService } from "./invoice.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { AuthGuard } from "@nestjs/passport";
import { UpdateInvoiceItemsDto } from "./dto/update-invoice-items.dto";
import { User } from "src/core/decorator/user.decorator";

@ApiTags('PurchaseItems')
@Controller('purchaseitems')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class PurchaseItemController {

    constructor(private purchaseInvoiceService:PurchaseInvoiceService){}

    @Get()
    async findAllItems(@Query('status') status) { //accept query params
      return this.purchaseInvoiceService.findAllItems({status});
    }

    @Get('/:id')
    async findItemById(@Param('id') id: string) {
      return this.purchaseInvoiceService.findItemById(id);
    }

    @Post('/saleprice')
    async findSalePrice(@Body() input:{productid:string,batch:string}) {
      return this.purchaseInvoiceService.findSalePrice(input);
    }

    // @Get('/:id/items')
    // async findItemsByInvoice(@Param('id') id: string) {
    //   return this.purchaseInvoiceService.findAllItemsByInvoice(id);
    // }

    @Post()
    async createItem(@Body() createPurchaseInvoiceItemDto: CreatePurchaseInvoiceItemDto, @User() currentUser: any) {
        const item = await this.purchaseInvoiceService.createItem(createPurchaseInvoiceItemDto, currentUser.id);
        await this.purchaseInvoiceService.findAllItemsByInvoice(item.invoiceid).then(async (items:any) => {
          let total = 0;
          items.forEach(item => {
            total += item.total && +item.total;
          })
          await this.purchaseInvoiceService.update([item.invoiceid],{total:Math.round(total)},currentUser.id)  
        })
        return item;
    }

    @Put()
    updateItems(@Body() input:UpdateInvoiceItemsDto, @User() currentUser: any) {
      return this.purchaseInvoiceService.updateItems(input.ids, input.values, currentUser.id);
    }

    @Delete()
    async remove(@Body() input:{invoiceid:number, ids:number[]}, @User() currentUser: any) {
      await this.purchaseInvoiceService.removeItems(input.ids).then(async(data) => {
        await this.purchaseInvoiceService.findAllItemsByInvoice(input.invoiceid).then(async (items:any) => {
          let total = 0;
          items.forEach(item => {
            total += item.total && +item.total;
          })
          await this.purchaseInvoiceService.update([input.invoiceid],{total},currentUser.id)  
        })
      })
    }
}