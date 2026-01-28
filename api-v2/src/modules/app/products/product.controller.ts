import { ProductService } from "./product.service";
import { PricingCalculatorService } from "./pricing-calculator.service";
import { PricingRulesService } from "./pricing-rules.service";
import { ProductOcrService } from "./product-ocr.service";
import { ApiBearerAuth, ApiTags, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, UploadedFile, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CreateProductDto } from "./dto/create-product.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";

import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateProductPrice2Dto } from "./dto/update-product-price2.dto";
import { CreateHsnTaxDto } from "./dto/create-hsn-tax.dto";
import { UpdateHsnTaxDto } from "./dto/update-hsn-tax.dto";
import { User } from "src/core/decorator/user.decorator";
import { multerOptions } from "../files/multer.config";

@ApiTags('Products')
@Controller('products')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ProductController {

    constructor(
        private productService:ProductService,
        private pricingCalculatorService:PricingCalculatorService,
        private pricingRulesService:PricingRulesService,
        private productOcrService:ProductOcrService
    ){}

    @Post()
    async create(@Body() createDto: CreateProductDto,  @User() currentUser: any) {
        return this.productService.create(createDto, currentUser.id);
    }

    // ========================================
    // OCR - Extract Product Info from Image
    // ========================================

    @Post('ocr/extract')
    @UseInterceptors(FileInterceptor('file', multerOptions))
    async extractProductInfo(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            return {
                success: false,
                message: 'No file uploaded'
            };
        }

        // Process the uploaded image with OCR
        const result = await this.productOcrService.processProductImage(file.path);

        return {
            ...result,
            uploadedFile: {
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            }
        };
    }

    @Post('ocr/extract-multiple')
    @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
    @ApiOperation({ summary: 'Extract product info from multiple images with combined contextualization' })
    async extractProductInfoFromMultipleImages(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            return {
                success: false,
                message: 'No files uploaded'
            };
        }

        // Extract image paths
        const imagePaths = files.map(file => file.path);

        // Process all images together with combined contextualization
        const result = await this.productOcrService.processMultipleProductImages(imagePaths);

        return {
            ...result,
            uploadedFiles: files.map(file => ({
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            }))
        };
    }

    @Post('/filter')
    async filterByCriteria(@Body() criteria: any) {
      return this.productService.filterByCriteria(criteria);
    }
    @Post('/filter2')
    async filterByCriteria2(@Body() criteria: any) {
      return this.productService.filterByCriteria2(criteria);
    }

    @Get('/categories')
    @ApiOperation({ summary: 'Get list of product categories' })
    async getCategories() {
      return this.productService.getCategories();
    }

    @Get('/dashboard/metrics')
    @ApiOperation({ summary: 'Get product dashboard metrics' })
    async getDashboardMetrics() {
      return this.productService.getDashboardMetrics();
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
    @ApiOperation({ summary: 'Get all products with optional filters' })
    @ApiQuery({ name: 'search', required: false, description: 'Search products by title (case-insensitive partial match)' })
    @ApiQuery({ name: 'category', required: false, description: 'Filter by exact category' })
    @ApiQuery({ name: 'title', required: false, description: 'Filter by exact title' })
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

    // ========================================
    // Lookup Endpoints (autocomplete)
    // ========================================

    @Get('lookup/brand/:term')
    async lookupBrand(@Param('term') term: string) {
      return this.productService.lookupBrand(term);
    }

    @Get('lookup/manufacturer/:term')
    async lookupManufacturer(@Param('term') term: string) {
      return this.productService.lookupManufacturer(term);
    }

    // ========================================
    // HSN Tax Master Management (must come before :id routes)
    // ========================================

    @Get('hsn-tax')
    async getAllHsnTaxCodes(@Query() query: any) {
      return this.productService.findAllHsnTaxCodes({
        taxCategory: query.category,
        activeOnly: query.activeOnly === 'true',
        searchTerm: query.search
      });
    }

    @Get('hsn-tax/statistics')
    async getHsnTaxStatistics() {
      return this.productService.getHsnTaxStatistics();
    }

    @Get('hsn-tax/categories')
    async getHsnTaxCategories() {
      return this.productService.getHsnTaxCategories();
    }

    @Get('hsn-tax/code/:code')
    async getHsnTaxByCode(@Param('code') code: string) {
      return this.productService.findHsnTaxByCode(code);
    }

    @Get('hsn-tax/code/:code/rate')
    async getHsnTaxRate(@Param('code') code: string, @Query('date') date?: string) {
      const effectiveDate = date ? new Date(date) : new Date();
      return this.productService.getTaxRateForHsn(code, effectiveDate);
    }

    @Get('hsn-tax/:id')
    async getHsnTaxById(@Param('id') id: number) {
      return this.productService.findHsnTaxById(id);
    }

    @Post('hsn-tax')
    async createHsnTax(@Body() dto: CreateHsnTaxDto, @User() currentUser: any) {
      return this.productService.createHsnTax(dto, currentUser.id);
    }

    @Put('hsn-tax/:id')
    async updateHsnTax(@Param('id') id: number, @Body() dto: UpdateHsnTaxDto, @User() currentUser: any) {
      return this.productService.updateHsnTax(id, dto, currentUser.id);
    }

    @Delete('hsn-tax/:id')
    async deleteHsnTax(@Param('id') id: number, @User() currentUser: any) {
      return this.productService.deleteHsnTax(id, currentUser.id);
    }

    // ========================================
    // Generic Product Routes (must come after specific routes)
    // ========================================

    @Get(':id/with-tax')
    async findOneWithTax(@Param('id') id: number) {
      return this.productService.getProductWithTaxRate(id);
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
      return this.productService.findById(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.productService.remove(parseInt(id), currentUser.id);
    }

    // ========================================
    // Pricing Calculator & Rules Endpoints
    // ========================================

    @Post('calculate-price')
    async calculatePrice(@Body() body: any) {
      return this.pricingCalculatorService.calculatePrice(body);
    }

    @Post('compare-pricing')
    async comparePricing(@Body() body: any) {
      const { ptr, mrp, taxRate, marginPercent, discountPercent, fixedPrice, taxInclusive } = body;
      return this.pricingCalculatorService.comparePricingStrategies(
        ptr, mrp, taxRate, marginPercent, discountPercent, fixedPrice, taxInclusive
      );
    }

    @Post(':id/calculate-with-rules')
    async calculatePriceWithRules(@Param('id') id: number, @Body() body: any) {
      const product = await this.productService.findById(id);
      if (!product) {
        throw new Error('Product not found');
      }

      const { ptr, mrp, quantity, taxInclusive } = body;

      // Get tax rate from HSN
      const productWithTax = await this.productService.getProductWithTaxRate(id);
      const taxRate = productWithTax?.taxRate?.totalRate || product.taxpcnt || 0;

      return this.pricingRulesService.calculatePriceWithRules(
        id,
        product.category,
        ptr,
        mrp,
        taxRate,
        quantity || 1,
        taxInclusive || false
      );
    }

    @Get('pricing-rules')
    async getPricingRules(@Query() query: any) {
      return this.pricingRulesService.findAll(query);
    }

    @Get('pricing-rules/statistics')
    async getPricingRulesStatistics() {
      return this.pricingRulesService.getRuleStatistics();
    }

    @Post('pricing-rules')
    async createPricingRule(@Body() body: any, @User() currentUser: any) {
      return this.pricingRulesService.createPricingRule(body, currentUser.id);
    }

    @Put('pricing-rules/:id')
    async updatePricingRule(@Param('id') id: number, @Body() body: any, @User() currentUser: any) {
      return this.pricingRulesService.updatePricingRule(id, body, currentUser.id);
    }

    @Post('pricing-rules/:id/activate')
    async activatePricingRule(@Param('id') id: number, @User() currentUser: any) {
      return this.pricingRulesService.activatePricingRule(id, currentUser.id);
    }

    @Post('pricing-rules/:id/pause')
    async pausePricingRule(@Param('id') id: number, @User() currentUser: any) {
      return this.pricingRulesService.pausePricingRule(id, currentUser.id);
    }

    @Delete('pricing-rules/:id')
    async deletePricingRule(@Param('id') id: number, @User() currentUser: any) {
      return this.pricingRulesService.deletePricingRule(id, currentUser.id);
    }

    // ========================================
    // Price Margins & Reports
    // ========================================

    @Get('margins/by-category')
    async getPriceMarginsByCategory() {
      return this.productService.getPriceMarginsByCategory();
    }

    @Get('margins/by-product/:category')
    async getPriceMarginsByProduct(@Param('category') category: string) {
      return this.productService.getPriceMarginsByProduct(category);
    }

    @Get('margins/trends')
    async getPricingTrends(@Query() query: any) {
      const startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const category = query.category;

      return this.productService.getPricingTrends(startDate, endDate, category);
    }

}