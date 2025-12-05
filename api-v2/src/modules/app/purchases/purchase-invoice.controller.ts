import { PurchaseInvoiceService } from "./purchase-invoice.service";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { UpdateInvoicesDto } from "./dto/update-invoices.dto";
import { User } from "src/core/decorator/user.decorator";

@ApiTags('PurchaseInvoices')
@Controller('purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard)
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
}