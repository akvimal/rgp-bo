import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { UpdateInvoiceItemsDto } from "./dto/update-invoice-items.dto";
import { User } from "src/core/decorator/user.decorator";
import { ProductService } from "../products/product.service";

@ApiTags('PurchaseItems')
@Controller('purchaseitems')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PurchaseItemController {

    constructor(private purchaseInvoiceService:PurchaseInvoiceService, private productService: ProductService){}

    @Get()
    async findAllItems(@Query('status') status) { //accept query params
      return this.purchaseInvoiceService.findAllItems({status});
    }

    @Get('/product/:id')
    async findItemsByProduct(@Param('id') id: number) { //accept query params
      return this.purchaseInvoiceService.findItemsByProduct(id);
    }

    @Get('/:id')
    async findItemById(@Param('id') id: number) {
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

      getSalePrice(priceBeforeTax,tax): number {
        const price = priceBeforeTax * (1-tax/100)
      return price + (priceBeforeTax - (price * (1 + tax/100)));
      }

    /**
     * Create purchase invoice item
     * Fix for issue #12: Atomic transaction now handled in service layer
     * All operations (item creation, price update, total recalculation) happen atomically
     */
    @Post()
    async createItem(@Body() createPurchaseInvoiceItemDto: CreatePurchaseInvoiceItemDto, @User() currentUser: any) {
        // Calculate sale price from MRP cost and tax
        const salePrice = this.getSalePrice(createPurchaseInvoiceItemDto.mrpcost, createPurchaseInvoiceItemDto.taxpcnt);

        // Service now handles all operations in a single transaction
        return await this.purchaseInvoiceService.createItem(
            createPurchaseInvoiceItemDto,
            currentUser.id,
            salePrice
        );
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

    @Post('/:id/verify')
    async verifyItem(@Param('id') id: number, @User() currentUser: any) {
      return this.purchaseInvoiceService.verifyItem(id, currentUser.id);
    }

    @Post('/:id/reject')
    async rejectItem(
      @Param('id') id: number,
      @Body() input: {reason: string},
      @User() currentUser: any
    ) {
      return this.purchaseInvoiceService.rejectItem(id, input.reason, currentUser.id);
    }

    @Post('/invoice/:invoiceId/verify-all')
    async verifyAllItems(@Param('invoiceId') invoiceId: number, @User() currentUser: any) {
      return this.purchaseInvoiceService.verifyAllItems(invoiceId, currentUser.id);
    }

    @Get('/invoice/:invoiceId/verification-status')
    async getVerificationStatus(@Param('invoiceId') invoiceId: number) {
      return this.purchaseInvoiceService.getItemVerificationStatus(invoiceId);
    }
}