import { ApiProperty } from '@nestjs/swagger';

export class PurchaseSummaryDto {
  @ApiProperty({ description: 'Total purchase value for current month' })
  totalPurchaseValueCurrentMonth: number;

  @ApiProperty({ description: 'Total purchase value for previous month' })
  totalPurchaseValuePreviousMonth: number;

  @ApiProperty({ description: 'Percentage change compared to previous month' })
  percentageChange: number;

  @ApiProperty({ description: 'Number of pending invoices' })
  pendingInvoicesCount: number;

  @ApiProperty({ description: 'Total value of pending invoices' })
  pendingInvoicesValue: number;

  @ApiProperty({ description: 'Number of approved and paid invoices' })
  approvedPaidCount: number;

  @ApiProperty({ description: 'Total value of approved and paid invoices' })
  approvedPaidValue: number;

  @ApiProperty({ description: 'Top vendor name' })
  topVendorName: string;

  @ApiProperty({ description: 'Top vendor purchase value' })
  topVendorValue: number;

  @ApiProperty({ description: 'Total number of invoices this month' })
  totalInvoicesThisMonth: number;

  @ApiProperty({ description: 'Average invoice value' })
  averageInvoiceValue: number;
}

export class MonthlyTrendDto {
  @ApiProperty({ description: 'Month in format YYYY-MM' })
  month: string;

  @ApiProperty({ description: 'Total purchase value for the month' })
  totalValue: number;

  @ApiProperty({ description: 'Number of invoices in the month' })
  invoiceCount: number;
}

export class InvoiceStatusBreakdownDto {
  @ApiProperty({ description: 'Status name' })
  status: string;

  @ApiProperty({ description: 'Count of invoices with this status' })
  count: number;

  @ApiProperty({ description: 'Total value of invoices with this status' })
  totalValue: number;

  @ApiProperty({ description: 'Percentage of total invoices' })
  percentage: number;
}

export class VendorAnalysisDto {
  @ApiProperty({ description: 'Vendor ID' })
  vendorId: number;

  @ApiProperty({ description: 'Vendor name' })
  vendorName: string;

  @ApiProperty({ description: 'Total purchase value' })
  totalPurchaseValue: number;

  @ApiProperty({ description: 'Number of invoices' })
  invoiceCount: number;

  @ApiProperty({ description: 'Average invoice value' })
  averageInvoiceValue: number;

  @ApiProperty({ description: 'Outstanding amount' })
  outstandingAmount: number;
}

export class RecentInvoiceDto {
  @ApiProperty({ description: 'Invoice ID' })
  id: number;

  @ApiProperty({ description: 'Invoice number' })
  invoiceNo: string;

  @ApiProperty({ description: 'Invoice date' })
  invoiceDate: string;

  @ApiProperty({ description: 'Vendor name' })
  vendorName: string;

  @ApiProperty({ description: 'Total amount' })
  total: number;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({ description: 'Payment status' })
  paymentStatus: string;

  @ApiProperty({ description: 'Lifecycle status' })
  lifecycleStatus: string;
}

export class PaymentTimelineDto {
  @ApiProperty({ description: 'Invoice ID' })
  invoiceId: number;

  @ApiProperty({ description: 'Invoice number' })
  invoiceNo: string;

  @ApiProperty({ description: 'Vendor name' })
  vendorName: string;

  @ApiProperty({ description: 'Total amount' })
  totalAmount: number;

  @ApiProperty({ description: 'Paid amount' })
  paidAmount: number;

  @ApiProperty({ description: 'Outstanding amount' })
  outstandingAmount: number;

  @ApiProperty({ description: 'Invoice date' })
  invoiceDate: string;

  @ApiProperty({ description: 'Days overdue (negative if not yet due)' })
  daysOverdue: number;
}

export class CategorySpendingDto {
  @ApiProperty({ description: 'Category name' })
  category: string;

  @ApiProperty({ description: 'Total spending in category' })
  totalSpending: number;

  @ApiProperty({ description: 'Percentage of total spending' })
  percentage: number;

  @ApiProperty({ description: 'Number of items' })
  itemCount: number;
}

export class NearExpiryMetricsDto {
  @ApiProperty({ description: 'Number of products expiring within 30 days (CRITICAL)' })
  criticalCount: number;

  @ApiProperty({ description: 'Total value at risk for products expiring within 30 days' })
  criticalValue: number;

  @ApiProperty({ description: 'Number of products expiring within 60 days (WARNING)' })
  warningCount: number;

  @ApiProperty({ description: 'Total value at risk for products expiring within 60 days' })
  warningValue: number;

  @ApiProperty({ description: 'Number of products expiring within 90 days (WATCH)' })
  watchCount: number;

  @ApiProperty({ description: 'Total value at risk for products expiring within 90 days' })
  watchValue: number;

  @ApiProperty({ description: 'Total count of near-expiry products (all thresholds)' })
  totalCount: number;

  @ApiProperty({ description: 'Total value at risk (all thresholds)' })
  totalValue: number;
}

export class PurchaseAnalyticsDto {
  @ApiProperty({ description: 'Summary metrics', type: PurchaseSummaryDto })
  summary: PurchaseSummaryDto;

  @ApiProperty({
    description: 'Monthly purchase trends for last 6 months',
    type: [MonthlyTrendDto],
  })
  monthlyTrends: MonthlyTrendDto[];

  @ApiProperty({
    description: 'Invoice status breakdown',
    type: [InvoiceStatusBreakdownDto],
  })
  statusBreakdown: InvoiceStatusBreakdownDto[];

  @ApiProperty({
    description: 'Top 5 vendors by purchase value',
    type: [VendorAnalysisDto],
  })
  topVendors: VendorAnalysisDto[];

  @ApiProperty({
    description: 'Recent invoices (last 7 days)',
    type: [RecentInvoiceDto],
  })
  recentInvoices: RecentInvoiceDto[];

  @ApiProperty({
    description: 'Payment timeline - upcoming and overdue payments',
    type: [PaymentTimelineDto],
  })
  paymentTimeline: PaymentTimelineDto[];

  @ApiProperty({
    description: 'Category-wise spending analysis',
    type: [CategorySpendingDto],
  })
  categorySpending: CategorySpendingDto[];

  @ApiProperty({
    description: 'Near-expiry inventory metrics',
    type: NearExpiryMetricsDto,
  })
  nearExpiryMetrics: NearExpiryMetricsDto;
}
