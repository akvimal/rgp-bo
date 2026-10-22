import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { InvoiceViewService } from "./invoice-view.service";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchasingGuard } from "../roles/purchasing.guard";
import { UpdateInvoicesDto } from "./dto/update-invoices.dto";
import { User } from "src/core/decorator/user.decorator";

@ApiTags('PurchaseInvoices')
@Controller('purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class PurchaseInvoiceController {

    constructor(private purchaseInvoiceService:PurchaseInvoiceService, private view:InvoiceViewService){}

    private filterOf(q:any){
      return { vendor: /^[0-9]+$/.test(String(q.vendor ?? '')) ? +q.vendor : undefined, from: q.from, to: q.to, q: q.q };
    }

    /** The invoice list: view = all | pending | overdue | due7 | hold | paid | draft, with vendor / date / invoice-no filters and paging. */
    @Get('/search')
    async search(@Query() q:any) {
      return this.view.search(this.filterOf(q), q.view, q.sort, q.dir, q.page ? +q.page : 1, q.limit ? +q.limit : 25);
    }

    /** Totals for the chips above the list. */
    @Get('/summary')
    async summary(@Query() q:any) {
      return this.view.summary(this.filterOf(q));
    }

    @Get('/:id/payments')
    async payments(@Param('id', ParseIntPipe) id:number) {
      return this.view.payments(id);
    }

    @Post('/:id/hold')
    async hold(@Param('id', ParseIntPipe) id:number, @Body() body:any, @User() currentUser:any) {
      if(typeof body?.reason !== 'string') throw new BadRequestException('Give a reason.');
      return this.view.hold(id, body.reason, currentUser.id);
    }

    @Post('/:id/release')
    async release(@Param('id', ParseIntPipe) id:number, @User() currentUser:any) {
      return this.view.release(id, currentUser.id);
    }

    @Get('/outstanding')
    async findOutstanding(@Query() query: any) {
      return this.purchaseInvoiceService.findOutstanding(query);
    }

    @Get('/payables')
    async findPayables() {
      return this.purchaseInvoiceService.findPayablesSummary();
    }

    @Get('/:id')
    async findById(@Param('id') id: string) {
      return this.purchaseInvoiceService.findById(id);
    }

    @Get()
    async findByUnique(@Query() query: any) {
      const hasFilter = Object.keys(query).some(k => !['page', 'limit', 'vendor'].includes(k));
      if (hasFilter)
        return this.purchaseInvoiceService.findByUnique(query);
      else {
        const page = query.page ? +query.page : 1;
        const limit = query.limit ? +query.limit : 50;
        const vendor = /^[0-9]+$/.test(String(query.vendor ?? '')) ? +query.vendor : undefined;
        return this.purchaseInvoiceService.findAll(page, limit, vendor);
      }
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
    remove(@Param('id', ParseIntPipe) id: number, @User() currentUser: any) {
      return this.purchaseInvoiceService.remove(id, currentUser.id);
    }
}
