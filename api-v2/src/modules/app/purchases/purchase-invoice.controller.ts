import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { InvoiceViewService } from "./invoice-view.service";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchasingGuard } from "../roles/purchasing.guard";
import { UpdateInvoicesDto } from "./dto/update-invoices.dto";
import { User } from "src/core/decorator/user.decorator";
import { ProductService } from "../products/product.service";

@ApiTags('PurchaseInvoices')
@Controller('purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class PurchaseInvoiceController {

    constructor(private purchaseInvoiceService:PurchaseInvoiceService, private view:InvoiceViewService, private products:ProductService){}

    private filterOf(q:any){
      return { vendor: /^[0-9]+$/.test(String(q.vendor ?? '')) ? +q.vendor : undefined, from: q.from, to: q.to, since: q.since, q: q.q, product: typeof q.product === 'string' ? q.product : undefined };
    }

    /** The invoice list: view = all | pending | overdue | due7 | hold | paid | draft, with vendor / date / invoice-no filters and paging. */
    @Get('/search')
    async search(@Query() q:any) {
      return this.view.search(this.filterOf(q), q.view, q.sort, q.dir, q.page ? +q.page : 1, q.limit ? +q.limit : 25);
    }

    /** The vendors that have invoices in the date window, for the vendor filter (so it does not list every vendor ever). */
    @Get('/vendors')
    async vendorsInWindow(@Query() q:any) {
      return this.view.vendors(this.filterOf(q));
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

    /** Each line's rate against the vendor's previous rate, and what it still needs before the invoice can be completed. */
    @Get('/:id/price-check')
    async priceCheck(@Param('id', ParseIntPipe) id:number) {
      return this.purchaseInvoiceService.priceCheck(id);
    }

    @Post('/:id/hold')
    async hold(@Param('id', ParseIntPipe) id:number, @Body() body:any, @User() currentUser:any) {
      if(typeof body?.reason !== 'string') throw new BadRequestException('Give a reason.');
      return this.view.hold(id, body.reason, currentUser.id);
    }

    /** Approval for payment: the rule (on/off and the limit), and approving or withdrawing an approval. */
    @Get('/approval-settings')
    async approvalSettings(@User() currentUser:any) {
      return this.view.approvalSettings(currentUser.id);
    }

    @Put('/approval-settings')
    async setApprovalSettings(@Body() body:any, @User() currentUser:any) {
      return this.view.setApprovalSettings(body, currentUser.id);
    }

    @Post('/:id/approve')
    async approve(@Param('id', ParseIntPipe) id:number, @Body() body:any, @User() currentUser:any) {
      return this.view.approve(id, body?.note, currentUser.id);
    }

    @Post('/:id/unapprove')
    async unapprove(@Param('id', ParseIntPipe) id:number, @User() currentUser:any) {
      return this.view.unapprove(id, currentUser.id);
    }

    @Post('/:id/release')
    async release(@Param('id', ParseIntPipe) id:number, @User() currentUser:any) {
      return this.view.release(id, currentUser.id);
    }

    /** Business Head: invoices whose stored total is off from what their lines come to (so the balance and the most a payment may be are wrong). ?invoiceid= checks one. */
    @Get('/total-check')
    async totalCheck(@Query('invoiceid') invoiceid:string, @User() currentUser:any) {
      return this.purchaseInvoiceService.totalCheck(currentUser.id, /^[0-9]+$/.test(String(invoiceid ?? '')) ? +invoiceid : undefined);
    }

    /** Business Head: puts those totals back to what the lines come to. Without confirm it only says what would change. */
    @Post('/total-fix')
    async totalFix(@Body() body:any, @User() currentUser:any) {
      return this.purchaseInvoiceService.totalFix(currentUser.id, body?.ids, body?.confirm === true);
    }

    /** Business Head: lines whose total is not qty x rate less discount (the usual reason an invoice total is off). ?invoiceid= checks one. */
    @Get('/line-check')
    async lineCheck(@Query('invoiceid') invoiceid:string, @User() currentUser:any) {
      return this.purchaseInvoiceService.lineCheck(currentUser.id, /^[0-9]+$/.test(String(invoiceid ?? '')) ? +invoiceid : undefined);
    }

    /** Business Head: puts those line totals right (the invoice total follows). Without confirm it only says what would change. */
    @Post('/line-fix')
    async lineFix(@Body() body:any, @User() currentUser:any) {
      return this.purchaseInvoiceService.lineFix(currentUser.id, body?.ids, body?.confirm === true);
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
      if(dto.id){
        await this.purchaseInvoiceService.assertEditable(currentUser.id, { invoiceIds: [dto.id] });
        const { draft, ...values } = dto as any;          // "draft" only matters when an invoice is first made
        return this.purchaseInvoiceService.update([dto.id], values, currentUser.id);
      }
      else {
        const result = await this.purchaseInvoiceService.getGRN('R'); 
        return this.purchaseInvoiceService.create({...dto, grno:result[0].generate_grn}, currentUser.id);
      }
    }

    @Put()
    async updateItems(@Body() input:UpdateInvoicesDto, @User() currentUser: any) {
      await this.purchaseInvoiceService.assertEditable(currentUser.id, { invoiceIds: input.ids });
      return this.purchaseInvoiceService.update(input.ids, input.values, currentUser.id);
    }

    @Put('/confirm')
    async confirm(@Body() input:UpdateInvoicesDto, @User() currentUser: any) {
      await this.purchaseInvoiceService.assertEditable(currentUser.id, { invoiceIds: input.ids });
      const result = await this.purchaseInvoiceService.update(input.ids, input.values, currentUser.id);
      // the goods are in stock now: a new product gets its first price at once when the business prices at the MRP
      if(input.values?.status === 'COMPLETE'){
        for(const id of input.ids) await this.products.autoPriceNew(id, currentUser.id);
      }
      return result;
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number, @User() currentUser: any) {
      await this.purchaseInvoiceService.assertEditable(currentUser.id, { invoiceIds: [id] });
      return this.purchaseInvoiceService.remove(id, currentUser.id);
    }
}
