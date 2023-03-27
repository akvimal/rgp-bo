import { ProductService } from "./product.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { AuthGuard } from "@nestjs/passport";
import { User } from "src/core/decorator/user.decorator";
import { UpdateProductDto } from "./dto/update-product.dto";

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

    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto: UpdateProductDto, @User() currentUser: any) {
      return this.productService.update(id, updateDto, currentUser.id);
    }

    @Get()
    findAll(@Query() query: any, @User() currentUser: any) {
      return this.productService.findAll(query,currentUser);
    }
    
    @Post('/title')
    findByTitle(@Body() body:any) {
      console.log('BODY: ',body);
      
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