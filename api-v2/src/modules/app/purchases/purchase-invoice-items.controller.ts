import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchasingGuard } from "../roles/purchasing.guard";
import { UpdateInvoiceItemsDto } from "./dto/update-invoice-items.dto";
import { User } from "src/core/decorator/user.decorator";

@ApiTags('PurchaseItems')
@Controller('purchaseitems')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class PurchaseItemController {

    constructor(private purchaseInvoiceService:PurchaseInvoiceService){}

    @Get()
    async findAllItems(@Query('status') status) { //accept query params
      return this.purchaseInvoiceService.findAllItems({status});
    }

    @Get('/product/:id')
    async findItemsByProduct(@Param('id') id: number) { //accept query params
      return this.purchaseInvoiceService.findItemsByProduct(id);
    }

    /** the earlier purchases of a product (received invoices), newest first, with the last, lowest and highest net rate; `exclude` leaves out the invoice being looked at */
    @Get('/history/:productid')
    async history(@Param('productid') productid: string, @Query('exclude') exclude: string) {
      return this.purchaseInvoiceService.purchaseHistory(+productid, /^\d+$/.test(exclude ?? '') ? +exclude : null);
    }

    /** the tax rates a line offers (the business's own list, else the usual rates of its type of business) */
    @Get('/tax-rates')
    async taxRates(@User() currentUser: any) {
      return this.purchaseInvoiceService.taxRates(currentUser.id);
    }

    @Get('/:id')
    async findItemById(@Param('id') id: number) {
      return this.purchaseInvoiceService.findItemById(id);
    }

    @Post('/saleprice')
    async findSalePrice(@Body() input:{productid:string,batch:string}) {
      return this.purchaseInvoiceService.findSalePrice(input);
    }

    @Post('/import-order/:invoiceid')
    async importOrderItems(@Param('invoiceid') invoiceid: number, @User() currentUser: any) {
      return this.purchaseInvoiceService.importOrderItems(+invoiceid, currentUser.id);
    }

    // @Get('/:id/items')
    // async findItemsByInvoice(@Param('id') id: string) {
    //   return this.purchaseInvoiceService.findAllItemsByInvoice(id);
    // }

    @Post()
    async createItem(@Body() createPurchaseInvoiceItemDto: CreatePurchaseInvoiceItemDto, @User() currentUser: any) {
        const item = await this.purchaseInvoiceService.createItem(createPurchaseInvoiceItemDto, currentUser.id);

        // A product with no price is not priced here: it appears under Products > Pricing policy > Needs a price once the invoice is completed,
        // with a suggested price from its class. (A price added here used to be skipped whenever the line itself had just made the product visible.)

        await this.purchaseInvoiceService.refreshTotal(item.invoiceid, currentUser.id);
        return item;
    }

    @Put()
    updateItems(@Body() input:UpdateInvoiceItemsDto, @User() currentUser: any) {
      return this.purchaseInvoiceService.updateItems(input.ids, input.values, currentUser.id);
    }

    /** lines the vendor must clarify: they leave the invoice total until accepted or rejected, and the invoice cannot be completed meanwhile */
    @Post('/dispute')
    dispute(@Body() input:{ids:number[], note:string}, @User() currentUser: any) {
      return this.purchaseInvoiceService.disputeItems(input?.ids, input?.note, currentUser.id);
    }

    @Post('/resolve')
    resolve(@Body() input:{ids:number[], action:string, note?:string}, @User() currentUser: any) {
      return this.purchaseInvoiceService.resolveItems(input?.ids, input?.action, input?.note, currentUser.id);
    }

    @Delete()
    async remove(@Body() input:{invoiceid:number, ids:number[]}, @User() currentUser: any) {
      await this.purchaseInvoiceService.removeItems(input.ids).then(async(data) => {
        await this.purchaseInvoiceService.refreshTotal(input.invoiceid, currentUser.id);
      })
      return { success: true, message: 'Items removed successfully' };
    }
}
