import { ProductService } from "./product.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";

import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateProductPrice2Dto } from "./dto/update-product-price2.dto";
import { User } from "src/core/decorator/user.decorator";
import { PermissionService } from "../roles/permission.service";

@ApiTags('Products')
@Controller('products')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ProductController {

    constructor(private productService:ProductService, private permissions: PermissionService){}

    private async assertPricingAccess(currentUser: any) {
      if (!(await this.permissions.canManagePricing(currentUser.roleid))) {
        throw new ForbiddenException('Pricing access denied');
      }
    }

    private async assertCostAccess(currentUser: any) {
      if (!(await this.permissions.canViewCost(currentUser.roleid))) {
        throw new ForbiddenException('Cost access denied');
      }
    }

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
        await this.assertPricingAccess(currentUser);
        return this.productService.addPrice(body, currentUser.id);
    } 
    
    @Put('prices/:id')
    async updatePrice(@Param('id') id: number, @Body() dto: UpdateProductPrice2Dto,  @User() currentUser: any) {
        await this.assertPricingAccess(currentUser);
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
    async findPriceById(@Param() param: any, @User() currentUser: any) {
      await this.assertCostAccess(currentUser);
      const prodid = +param.prodid;
      // price_view only has a row once the product has been received via a GRN;
      // a product priced manually before its first purchase has none.
      const price: any = await this.productService.findPriceById(prodid);
      const history = await this.productService.findPriceHistoryById(prodid);
      return { price: price[0] ?? null, history };
    }

    @Get()
    findAll(@Query() query: any, @User() currentUser: any) {
      return this.productService.findAll(query,currentUser);
    }

    @Post('/prices')
    async findAllPrices(@Body() criteria:any, @User() currentUser: any) {
      await this.assertCostAccess(currentUser);
      return this.productService.findPrices(criteria);
    }
    
    @Post('/title')
    findByTitle(@Body() body:any) {
      return this.productService.findByTitle(body.title);
    }
    
    @Get(':id')
    async findOne(@Param('id') id: number) {
      return this.productService.findById(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.productService.update(id, {isActive:false}, currentUser.id);
    }

}
