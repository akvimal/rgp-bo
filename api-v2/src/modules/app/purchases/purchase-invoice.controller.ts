import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { TaxCreditService } from "./tax-credit.service";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { UpdateInvoicesDto } from "./dto/update-invoices.dto";
import { User } from "src/core/decorator/user.decorator";
import { CreateTaxCreditDto, UpdateTaxCreditDto, ReportMismatchDto } from "./dto/create-tax-credit.dto";

@ApiTags('PurchaseInvoices')
@Controller('purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PurchaseInvoiceController {

    constructor(
        private purchaseInvoiceService:PurchaseInvoiceService,
        private taxCreditService: TaxCreditService
    ){}

    @Get('/:id')
    async findById(@Param('id') id: string) {
      return this.purchaseInvoiceService.findById(id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all invoices with optional pagination' })
    @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
    async findByUnique(
      @Query() query: any,
      @Query('page') page?: string,
      @Query('limit') limit?: string
    ) {
      // If specific query parameters provided, find by unique criteria
      if(Object.keys(query).filter(key => key !== 'page' && key !== 'limit').length > 0)
        return this.purchaseInvoiceService.findByUnique(query);

      // Otherwise return all with optional pagination
      const pageNum = page ? parseInt(page) : undefined;
      const limitNum = limit ? parseInt(limit) : undefined;
      return this.purchaseInvoiceService.findAll(pageNum, limitNum);
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

    // ========== Lifecycle Management Endpoints ==========

    @Post('/:id/complete')
    @ApiOperation({ summary: 'Complete invoice after all items verified' })
    @ApiResponse({ status: 200, description: 'Invoice completed successfully' })
    @ApiResponse({ status: 400, description: 'Cannot complete invoice - not all items verified' })
    async completeInvoice(@Param('id') id: string, @User() currentUser: any) {
      await this.purchaseInvoiceService.completeInvoice(parseInt(id), currentUser.id);
      return { message: 'Invoice completed successfully' };
    }

    @Get('/:id/can-close')
    @ApiOperation({ summary: 'Check if invoice can be closed' })
    @ApiResponse({ status: 200, description: 'Returns whether invoice can be closed and reasons if not' })
    async canCloseInvoice(@Param('id') id: string) {
      return this.purchaseInvoiceService.canCloseInvoice(parseInt(id));
    }

    @Post('/:id/close')
    @ApiOperation({ summary: 'Close invoice after payment and tax reconciliation' })
    @ApiResponse({ status: 200, description: 'Invoice closed successfully' })
    @ApiResponse({ status: 400, description: 'Cannot close invoice - requirements not met' })
    async closeInvoice(
      @Param('id') id: string,
      @Body() body: { notes?: string },
      @User() currentUser: any
    ) {
      await this.purchaseInvoiceService.closeInvoice(parseInt(id), currentUser.id, body.notes);
      return { message: 'Invoice closed successfully' };
    }

    @Post('/:id/reopen')
    @ApiOperation({ summary: 'Reopen a closed invoice' })
    @ApiResponse({ status: 200, description: 'Invoice reopened successfully' })
    @ApiResponse({ status: 400, description: 'Invoice is not closed' })
    async reopenInvoice(@Param('id') id: string, @User() currentUser: any) {
      await this.purchaseInvoiceService.reopenInvoice(parseInt(id), currentUser.id);
      return { message: 'Invoice reopened successfully' };
    }

    @Get('/:id/lifecycle-summary')
    @ApiOperation({ summary: 'Get comprehensive invoice lifecycle status' })
    @ApiResponse({ status: 200, description: 'Returns invoice status, items, financial data, and workflow flags' })
    async getLifecycleSummary(@Param('id') id: string) {
      return this.purchaseInvoiceService.getInvoiceLifecycleSummary(parseInt(id));
    }

    @Put('/:id/payment-status')
    @ApiOperation({ summary: 'Update payment status from payments' })
    @ApiResponse({ status: 200, description: 'Payment status updated successfully' })
    async updatePaymentStatus(@Param('id') id: string) {
      await this.purchaseInvoiceService.updatePaymentStatus(parseInt(id));
      return { message: 'Payment status updated successfully' };
    }

    // ========== Payment Management Endpoints ==========

    @Post('/:id/payments')
    @ApiOperation({ summary: 'Create payment for invoice' })
    @ApiResponse({ status: 201, description: 'Payment created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid payment data' })
    async createPayment(
      @Param('id') id: string,
      @Body() paymentData: any,
      @User() currentUser: any
    ) {
      return this.purchaseInvoiceService.createPayment(parseInt(id), paymentData, currentUser.id);
    }

    @Post('/:id/quick-payment')
    @ApiOperation({ summary: 'Quick payment - Mark invoice as paid (Issue #61)' })
    @ApiResponse({ status: 201, description: 'Quick payment created successfully' })
    @ApiResponse({ status: 400, description: 'Invoice not found or already fully paid' })
    async createQuickPayment(
      @Param('id') id: string,
      @Body() body: { paymentMode: string; paymentDate?: string },
      @User() currentUser: any
    ) {
      const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
      return this.purchaseInvoiceService.createQuickPayment(
        parseInt(id),
        body.paymentMode || 'CASH',
        paymentDate,
        currentUser.id
      );
    }

    @Get('/:id/payments')
    @ApiOperation({ summary: 'Get all payments for invoice' })
    @ApiResponse({ status: 200, description: 'Returns list of payments' })
    async getPayments(@Param('id') id: string) {
      return this.purchaseInvoiceService.getPaymentsByInvoice(parseInt(id));
    }

    @Get('/:id/payments/summary')
    @ApiOperation({ summary: 'Get payment summary for invoice' })
    @ApiResponse({ status: 200, description: 'Returns payment summary with totals' })
    async getPaymentSummary(@Param('id') id: string) {
      return this.purchaseInvoiceService.getPaymentSummary(parseInt(id));
    }

    @Put('/payments/:paymentId')
    @ApiOperation({ summary: 'Update payment details' })
    @ApiResponse({ status: 200, description: 'Payment updated successfully' })
    async updatePayment(
      @Param('paymentId') paymentId: string,
      @Body() updateData: any,
      @User() currentUser: any
    ) {
      await this.purchaseInvoiceService.updatePayment(parseInt(paymentId), updateData, currentUser.id);
      return { message: 'Payment updated successfully' };
    }

    @Put('/payments/:paymentId/reconcile')
    @ApiOperation({ summary: 'Reconcile payment' })
    @ApiResponse({ status: 200, description: 'Payment reconciled successfully' })
    async reconcilePayment(
      @Param('paymentId') paymentId: string,
      @Body() body: { reconciled: boolean; notes?: string },
      @User() currentUser: any
    ) {
      await this.purchaseInvoiceService.reconcilePayment(
        parseInt(paymentId),
        body.reconciled,
        body.notes || '',
        currentUser.id
      );
      return { message: 'Payment reconciliation updated' };
    }

    @Delete('/payments/:paymentId')
    @ApiOperation({ summary: 'Delete payment' })
    @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
    async deletePayment(@Param('paymentId') paymentId: string) {
      await this.purchaseInvoiceService.deletePayment(parseInt(paymentId));
      return { message: 'Payment deleted successfully' };
    }

    // ========== Tax Credit Reconciliation Endpoints ==========

    @Post('/:id/tax-credits')
    @ApiOperation({ summary: 'Create tax credit record for invoice' })
    @ApiResponse({ status: 201, description: 'Tax credit created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid data or tax credit already exists' })
    async createTaxCredit(
      @Param('id') id: string,
      @Body() dto: CreateTaxCreditDto,
      @User() currentUser: any
    ) {
      return this.taxCreditService.create({ ...dto, invoiceid: parseInt(id) }, currentUser.id);
    }

    @Get('/:id/tax-credits')
    @ApiOperation({ summary: 'Get tax credit record by invoice ID' })
    @ApiResponse({ status: 200, description: 'Returns tax credit record' })
    async getTaxCreditByInvoice(@Param('id') id: string) {
      return this.taxCreditService.findByInvoice(parseInt(id));
    }

    @Put('/tax-credits/:taxCreditId/filing-status')
    @ApiOperation({ summary: 'Update tax filing status' })
    @ApiResponse({ status: 200, description: 'Filing status updated successfully' })
    @ApiResponse({ status: 400, description: 'Tax credit not found' })
    async updateTaxFilingStatus(
      @Param('taxCreditId') taxCreditId: string,
      @Body() dto: UpdateTaxCreditDto,
      @User() currentUser: any
    ) {
      await this.taxCreditService.updateFilingStatus(parseInt(taxCreditId), dto, currentUser.id);
      return { message: 'Filing status updated successfully' };
    }

    @Put('/tax-credits/:taxCreditId/mismatch')
    @ApiOperation({ summary: 'Report tax mismatch' })
    @ApiResponse({ status: 200, description: 'Mismatch reported successfully' })
    @ApiResponse({ status: 400, description: 'Tax credit not found' })
    async reportTaxMismatch(
      @Param('taxCreditId') taxCreditId: string,
      @Body() dto: ReportMismatchDto,
      @User() currentUser: any
    ) {
      await this.taxCreditService.reportMismatch(parseInt(taxCreditId), dto, currentUser.id);
      return { message: 'Mismatch reported successfully' };
    }

    @Delete('/tax-credits/:taxCreditId')
    @ApiOperation({ summary: 'Delete tax credit record' })
    @ApiResponse({ status: 200, description: 'Tax credit deleted successfully' })
    async deleteTaxCredit(@Param('taxCreditId') taxCreditId: string) {
      await this.taxCreditService.delete(parseInt(taxCreditId));
      return { message: 'Tax credit deleted successfully' };
    }
}