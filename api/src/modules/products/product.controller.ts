import { ProductService } from "./product.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { AuthGuard } from "@nestjs/passport";
import { User } from "src/core/decorator/user.decorator";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateProductPrice2Dto } from "./dto/create-product-price2.dto";
import { UpdateProductPrice2Dto } from "./dto/update-product-price2.dto";

@ApiTags('Products')
@Controller('products')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class ProductController {

    constructor(private productService:ProductService){}

    @Post()
    async create(@Body() createDto: CreateProductDto,  @User() currentUser: any) {
        return this.productService.create(createDto, currentUser.id);
    }

    @Post('/filter')
    async filterByCriteria(@Body() criteria: any) {
      return this.productService.filterByCriteria(criteria);
    }
    @Post('/filter2')
    async filterByCriteria2(@Body() criteria: any) {
      return this.productService.filterByCriteria2(criteria);
    }

    @Post('prices/add')
    async addPrice(@Body() body,  @User() currentUser: any) {
        return this.productService.addPrice(body, currentUser.id);
    } 
    
    @Put('prices/:id')
    async updatePrice(@Param('id') id: number, @Body() dto: UpdateProductPrice2Dto,  @User() currentUser: any) {
        return this.productService.updatePrice(id, dto, currentUser.id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto: UpdateProductDto, @User() currentUser: any) {
      return this.productService.update(id, updateDto, currentUser.id);
    }

    // @Put(':productid/prices/:id')
    // updatePrice(@Param('id') id: number, @Param('productid') productid: number, @Body() updateDto: UpdateProductPrice2Dto, @User() currentUser: any) {
    //   return this.productService.updatePrice(id, {...updateDto, productid}, currentUser.id);
    // }

    @Get('/prices/:prodid')
    findPriceById(@Param() param: any, @User() currentUser: any) {
      return this.productService.findPriceById(param.prodid).then(async (price:any) => {
        const history = await this.productService.findPriceHistoryById(price[0].id);
        return {price:price[0], history};
      });
    }

    @Get()
    findAll(@Query() query: any, @User() currentUser: any) {
      return this.productService.findAll(query,currentUser);
    }

    @Post('/prices')
    findAllPrices(@Body() criteria:any) {
      return this.productService.findPrices(criteria);
    }
    
    @Post('/title')
    findByTitle(@Body() body:any) {
      return this.productService.findByTitle(body.title);
    }
    
    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.productService.findById(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.productService.update(id, {isActive:false}, currentUser.id);
    }

}