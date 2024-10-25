import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { User } from "src/core/decorator/user.decorator";
import { ProductPriceChange } from "src/entities/product-pricechange.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { PurchaseInvoiceService } from "../purchases/purchase-invoice.service";
import { CreateProductPriceDto } from "./dto/create-product-price.dto";
import { CreateProductQtyChangeDto } from "./dto/create-product-qtychange.dto";
import { StockService } from "./stock.service";

@ApiTags('Stock')
@Controller('stock')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class StockController {
    
    constructor(private service:StockService, private invoiceService:PurchaseInvoiceService){}

    @Get()
    async findAll() {
      return this.service.findAll();
    }

    @Get('/ready')
    async findAllReady() {
      return this.service.findAllReady();
    }

    @Post('/demand')
    async findDemand(@Body() input: {begindt:string,enddt:string,orders_avail:boolean}) {
      return this.service.findStockDemand(input);
    }

    @Get('/adjust/price')
    async findAllPriceAdjust() {
      return (await this.service.findAllPriceAdjust()).map((data:ProductPriceChange) => {
        return {
          itemid: data.purchaseitem.id,
          title: data.purchaseitem.product.title,
          date: data.createdon,
          price: data.price,
          batch: data.purchaseitem.batch,
          expdate: data.purchaseitem.expdate,
          oldprice: data.oldprice,
          comments: data.comments
        }
      });
    }

    @Get('/adjust/qty')
    async findAllQtyAdjust() {
      return (await this.service.findAllQtyAdjust()).map((data:ProductQtyChange) => {
        return {
          itemid: data.purchaseitem.id,
          title: data.purchaseitem.product.title,
          date: data.createdon,
          qty: data.qty,
          price: data.price,
          batch: data.purchaseitem.batch,
          expdate: data.purchaseitem.expdate,
          reason: data.reason,
          status: data.status,
          comments: data.comments
        }
      });
    }

    @Post('/adjust/price')
    async createPrice(@Body() createDto: CreateProductPriceDto, 
    @User() currentUser: any) {
        const updated = await this.invoiceService.updateItems([createDto.itemid],{saleprice:createDto.price},currentUser.id);
        return this.service.createPrice(createDto, currentUser.id);
    }

    @Post('/adjust/qty')
    async updateQty(@Body() createDto: CreateProductQtyChangeDto, 
    @User() currentUser: any) {
        // const updated = await this.invoiceService.updateItems([createDto.itemid],{saleprice:createDto.price},currentUser.id);
        return this.service.createQty(createDto, currentUser.id);
    }
    // @Get()
    // async findByCriteria() {
    //   return this.service.findByCriteria({});
    // }
}