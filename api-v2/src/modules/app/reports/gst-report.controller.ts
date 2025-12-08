import { Controller, Get, Post, Put, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GstReportService } from './gst-report.service';
import { AuthGuard } from 'src/modules/auth/auth.guard';

@ApiTags('GST Reports')
@Controller('gst-reports')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GstReportController {
  constructor(private readonly gstReportService: GstReportService) {}

  // ============================================================================
  // GSTR-1 Reports (Sales)
  // ============================================================================

  @Get('gstr1/b2b')
  @ApiOperation({ summary: 'GSTR-1 B2B Sales Report (Table 4)' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr1B2bSales(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getGstr1B2bSales(startDate, endDate);
  }

  @Get('gstr1/b2c-large')
  @ApiOperation({ summary: 'GSTR-1 B2C Large Sales Report (Table 6C) - Invoices > ₹2.5 Lakhs' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr1B2cLarge(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getGstr1B2cLarge(startDate, endDate);
  }

  @Get('gstr1/b2c-small')
  @ApiOperation({ summary: 'GSTR-1 B2C Small Sales Summary (Table 7) - Invoices ≤ ₹2.5 Lakhs' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr1B2cSmall(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getGstr1B2cSmall(startDate, endDate);
  }

  @Get('gstr1/hsn-summary')
  @ApiOperation({ summary: 'GSTR-1 HSN Summary (Table 12)' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr1HsnSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getGstr1HsnSummary(startDate, endDate);
  }

  @Get('gstr1/complete')
  @ApiOperation({ summary: 'Complete GSTR-1 Report (All Tables)' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr1Complete(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const [b2b, b2cLarge, b2cSmall, hsnSummary] = await Promise.all([
      this.gstReportService.getGstr1B2bSales(startDate, endDate),
      this.gstReportService.getGstr1B2cLarge(startDate, endDate),
      this.gstReportService.getGstr1B2cSmall(startDate, endDate),
      this.gstReportService.getGstr1HsnSummary(startDate, endDate),
    ]);

    return {
      period: { startDate, endDate },
      b2b,
      b2cLarge,
      b2cSmall,
      hsnSummary,
    };
  }

  // ============================================================================
  // GSTR-3B Reports (Summary)
  // ============================================================================

  @Get('gstr3b/sales-summary')
  @ApiOperation({ summary: 'GSTR-3B Sales Summary by Tax Rate (Table 3.1)' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr3bSalesSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getGstr3bSalesSummary(startDate, endDate);
  }

  @Get('gstr3b/itc-available')
  @ApiOperation({ summary: 'GSTR-3B ITC Available (Table 4)' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr3bItcAvailable(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getGstr3bItcAvailable(startDate, endDate);
  }

  @Get('gstr3b/complete')
  @ApiOperation({ summary: 'Complete GSTR-3B Report Data' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstr3bComplete(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const [salesSummary, itcAvailable, gstSummary] = await Promise.all([
      this.gstReportService.getGstr3bSalesSummary(startDate, endDate),
      this.gstReportService.getGstr3bItcAvailable(startDate, endDate),
      this.gstReportService.getGstSummary(startDate, endDate),
    ]);

    return {
      period: { startDate, endDate},
      table31: salesSummary,
      table4: itcAvailable,
      summary: gstSummary,
    };
  }

  // ============================================================================
  // Purchase & ITC Reports
  // ============================================================================

  @Get('purchases/reconciliation')
  @ApiOperation({ summary: 'Purchase Reconciliation Report (for GSTR-2B comparison)' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getPurchaseReconciliation(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getPurchaseReconciliation(
      startDate,
      endDate,
    );
  }

  @Get('purchases/vendor-wise-itc')
  @ApiOperation({ summary: 'Vendor-wise ITC Summary' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getVendorWiseItc(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getVendorWiseItc(startDate, endDate);
  }

  @Get('itc/dashboard')
  @ApiOperation({ summary: 'ITC Dashboard - Monthly Summary' })
  async getItcDashboard() {
    return await this.gstReportService.getItcDashboard();
  }

  @Get('itc/payment-risk')
  @ApiOperation({
    summary: 'ITC Payment Risk Report - Invoices at risk of ITC reversal',
  })
  async getItcPaymentRisk() {
    return await this.gstReportService.getItcPaymentRisk();
  }

  // ============================================================================
  // ITC Management Operations
  // ============================================================================

  @Put('itc/update-status')
  @ApiOperation({ summary: 'Update ITC status for invoices' })
  async updateItcStatus(
    @Body()
    body: {
      invoiceIds: number[];
      status: 'ITC_ELIGIBLE' | 'ITC_INELIGIBLE' | 'ITC_CLAIMED' | 'ITC_REVERSED';
      reason?: string;
    },
  ) {
    return await this.gstReportService.updateItcStatus(
      body.invoiceIds,
      body.status,
      body.reason,
    );
  }

  @Post('itc/mark-gstr2b-verified')
  @ApiOperation({ summary: 'Mark invoices as verified in GSTR-2B' })
  async markGstr2bVerified(@Body() body: { invoiceIds: number[] }) {
    return await this.gstReportService.markGstr2bVerified(body.invoiceIds);
  }

  @Post('itc/bulk-claim')
  @ApiOperation({ summary: 'Bulk claim ITC for a month' })
  async bulkClaimItc(
    @Body() body: { startDate: string; endDate: string },
  ) {
    return await this.gstReportService.bulkClaimItc(
      body.startDate,
      body.endDate,
    );
  }

  // ============================================================================
  // Summary & Dashboard
  // ============================================================================

  @Get('summary')
  @ApiOperation({ summary: 'GST Summary for Dashboard' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getGstSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getGstSummary(startDate, endDate);
  }

  @Get('validation/missing-data')
  @ApiOperation({ summary: 'Missing Data Report (validation)' })
  @ApiQuery({ name: 'startDate', example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', example: '2026-01-31' })
  async getMissingDataReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.gstReportService.getMissingDataReport(startDate, endDate);
  }
}
