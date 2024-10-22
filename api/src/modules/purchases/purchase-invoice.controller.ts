import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { AuthGuard } from "@nestjs/passport";
import { UpdateInvoicesDto } from "./dto/update-invoices.dto";
import { User } from "src/core/decorator/user.decorator";

@ApiTags('PurchaseInvoices')
@Controller('purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class PurchaseInvoiceController {

    constructor(private purchaseInvoiceService:PurchaseInvoiceService){}

    @Get('/:id')
    async findById(@Param('id') id: string) {
      return this.purchaseInvoiceService.findById(id);
    }

    @Get()
    async findByUnique(@Query() query: any) {
      if(Object.keys(query).length > 0)
        return this.purchaseInvoiceService.findByUnique(query);
      else
        return this.purchaseInvoiceService.findAll();
    }

    @Post()
    async create(@Body() dto: CreatePurchaseInvoiceDto, @User() currentUser: any) {
      if(dto.id)
        return this.purchaseInvoiceService.update([dto.id], dto, currentUser.id);
      else {
        const result = await this.purchaseInvoiceService.getGRN('R'); 
        return this.purchaseInvoiceService.create({...dto, grno:result[0].generate_grn}, currentUser.id);
      }
    }

    @Put()
    updateItems(@Body() input:UpdateInvoicesDto, @User() currentUser: any) {
      return this.purchaseInvoiceService.update(input.ids, input.values, currentUser.id);
    }

    @Put('/confirm')
    async confirm(@Body() input:UpdateInvoicesDto, @User() currentUser: any) {
      return await this.purchaseInvoiceService.update(input.ids, input.values, currentUser.id);
    }

    @Delete(':id')
    remove(@Param('id') id: any) {
      return this.purchaseInvoiceService.remove(id);
    }
}