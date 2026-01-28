import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseInvoice } from '../../../entities/purchase-invoice.entity';
import { PurchaseInvoiceItem } from '../../../entities/purchase-invoice-item.entity';
import { BatchAllocationService } from '../stock/batch-allocation.service';
import {
  PurchaseAnalyticsDto,
  PurchaseSummaryDto,
  MonthlyTrendDto,
  InvoiceStatusBreakdownDto,
  VendorAnalysisDto,
  RecentInvoiceDto,
  PaymentTimelineDto,
  CategorySpendingDto,
  NearExpiryMetricsDto,
} from './dto/purchase-analytics.dto';

@Injectable()
export class PurchaseAnalyticsService {
  private readonly logger = new Logger(PurchaseAnalyticsService.name);

  constructor(
    @InjectRepository(PurchaseInvoice)
    private readonly invoiceRepository: Repository<PurchaseInvoice>,
    @InjectRepository(PurchaseInvoiceItem)
    private readonly invoiceItemRepository: Repository<PurchaseInvoiceItem>,
    private readonly batchAllocationService: BatchAllocationService,
  ) {}

  async getAnalytics(): Promise<PurchaseAnalyticsDto> {
    this.logger.log('Generating purchase analytics...');

    const [
      summary,
      monthlyTrends,
      statusBreakdown,
      topVendors,
      recentInvoices,
      paymentTimeline,
      categorySpending,
      nearExpiryMetrics,
    ] = await Promise.all([
      this.getSummary(),
      this.getMonthlyTrends(),
      this.getStatusBreakdown(),
      this.getTopVendors(),
      this.getRecentInvoices(),
      this.getPaymentTimeline(),
      this.getCategorySpending(),
      this.getNearExpiryMetrics(),
    ]);

    return {
      summary,
      monthlyTrends,
      statusBreakdown,
      topVendors,
      recentInvoices,
      paymentTimeline,
      categorySpending,
      nearExpiryMetrics,
    };
  }

  private async getSummary(): Promise<PurchaseSummaryDto> {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month purchases
    const currentMonthData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total)', 'total')
      .addSelect('COUNT(invoice.id)', 'count')
      .addSelect('AVG(invoice.total)', 'average')
      .where('invoice.invoice_date >= :start', {
        start: currentMonth.toISOString().split('T')[0],
      })
      .andWhere('invoice.active = true')
      .getRawOne();

    // Previous month purchases
    const previousMonthData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total)', 'total')
      .where('invoice.invoice_date >= :start', {
        start: previousMonth.toISOString().split('T')[0],
      })
      .andWhere('invoice.invoice_date <= :end', {
        end: previousMonthEnd.toISOString().split('T')[0],
      })
      .andWhere('invoice.active = true')
      .getRawOne();

    // Pending invoices
    const pendingData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(invoice.id)', 'count')
      .addSelect('SUM(invoice.total)', 'total')
      .where('invoice.lifecycle_status = :status', { status: 'OPEN' })
      .andWhere('invoice.payment_status != :paid', { paid: 'PAID' })
      .andWhere('invoice.active = true')
      .getRawOne();

    // Approved and paid
    const approvedPaidData = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(invoice.id)', 'count')
      .addSelect('SUM(invoice.total)', 'total')
      .where('invoice.payment_status = :paid', { paid: 'PAID' })
      .andWhere('invoice.active = true')
      .getRawOne();

    // Top vendor
    const topVendor = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.vendor', 'vendor')
      .select('vendor.name', 'vendorname')
      .addSelect('SUM(invoice.total)', 'totalvalue')
      .where('invoice.active = true')
      .groupBy('vendor.id')
      .addGroupBy('vendor.name')
      .orderBy('totalvalue', 'DESC')
      .limit(1)
      .getRawOne();

    const currentTotal = parseFloat(currentMonthData?.total || 0);
    const previousTotal = parseFloat(previousMonthData?.total || 0);
    const percentageChange =
      previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal) * 100
        : 0;

    return {
      totalPurchaseValueCurrentMonth: currentTotal,
      totalPurchaseValuePreviousMonth: previousTotal,
      percentageChange: Math.round(percentageChange * 100) / 100,
      pendingInvoicesCount: parseInt(pendingData?.count || 0),
      pendingInvoicesValue: parseFloat(pendingData?.total || 0),
      approvedPaidCount: parseInt(approvedPaidData?.count || 0),
      approvedPaidValue: parseFloat(approvedPaidData?.total || 0),
      topVendorName: topVendor?.vendorname || 'N/A',
      topVendorValue: parseFloat(topVendor?.totalvalue || 0),
      totalInvoicesThisMonth: parseInt(currentMonthData?.count || 0),
      averageInvoiceValue: parseFloat(currentMonthData?.average || 0),
    };
  }

  private async getMonthlyTrends(): Promise<MonthlyTrendDto[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trends = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select(
        "TO_CHAR(invoice.invoice_date::date, 'YYYY-MM')",
        'month',
      )
      .addSelect('SUM(invoice.total)', 'totalvalue')
      .addSelect('COUNT(invoice.id)', 'invoicecount')
      .where('invoice.invoice_date >= :start', {
        start: sixMonthsAgo.toISOString().split('T')[0],
      })
      .andWhere('invoice.active = true')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return trends.map((t) => ({
      month: t.month,
      totalValue: parseFloat(t.totalvalue || 0),
      invoiceCount: parseInt(t.invoicecount || 0),
    }));
  }

  private async getStatusBreakdown(): Promise<InvoiceStatusBreakdownDto[]> {
    const breakdown = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.lifecycle_status', 'status')
      .addSelect('COUNT(invoice.id)', 'count')
      .addSelect('SUM(invoice.total)', 'totalvalue')
      .where('invoice.active = true')
      .groupBy('invoice.lifecycle_status')
      .getRawMany();

    const totalInvoices = breakdown.reduce(
      (sum, item) => sum + parseInt(item.count),
      0,
    );

    return breakdown.map((item) => ({
      status: item.status,
      count: parseInt(item.count),
      totalValue: parseFloat(item.totalvalue || 0),
      percentage:
        totalInvoices > 0
          ? Math.round((parseInt(item.count) / totalInvoices) * 10000) / 100
          : 0,
    }));
  }

  private async getTopVendors(): Promise<VendorAnalysisDto[]> {
    const vendors = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.vendor', 'vendor')
      .select('vendor.id', 'vendorid')
      .addSelect('vendor.name', 'vendorname')
      .addSelect('SUM(invoice.total)', 'totalpurchasevalue')
      .addSelect('COUNT(invoice.id)', 'invoicecount')
      .addSelect('AVG(invoice.total)', 'averageinvoicevalue')
      .addSelect(
        'SUM(invoice.total - invoice.paid_amount)',
        'outstandingamount',
      )
      .where('invoice.active = true')
      .groupBy('vendor.id')
      .addGroupBy('vendor.name')
      .orderBy('totalpurchasevalue', 'DESC')
      .limit(5)
      .getRawMany();

    return vendors.map((v) => ({
      vendorId: v.vendorid,
      vendorName: v.vendorname,
      totalPurchaseValue: parseFloat(v.totalpurchasevalue || 0),
      invoiceCount: parseInt(v.invoicecount || 0),
      averageInvoiceValue: parseFloat(v.averageinvoicevalue || 0),
      outstandingAmount: parseFloat(v.outstandingamount || 0),
    }));
  }

  private async getRecentInvoices(): Promise<RecentInvoiceDto[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const invoices = await this.invoiceRepository.find({
      relations: ['vendor'],
      order: {
        invoicedate: 'DESC',
      },
      take: 10,
    });

    return invoices
      .filter(
        (invoice) => new Date(invoice.invoicedate) >= sevenDaysAgo,
      )
      .map((invoice) => ({
        id: invoice.id,
        invoiceNo: invoice.invoiceno,
        invoiceDate: invoice.invoicedate,
        vendorName: invoice.vendor?.name || 'Unknown',
        total: invoice.total || 0,
        status: invoice.status,
        paymentStatus: invoice.paymentstatus,
        lifecycleStatus: invoice.lifecyclestatus,
      }));
  }

  private async getPaymentTimeline(): Promise<PaymentTimelineDto[]> {
    const invoices = await this.invoiceRepository.find({
      where: {
        paymentstatus: 'UNPAID',
      },
      relations: ['vendor'],
      order: {
        invoicedate: 'ASC',
      },
      take: 20,
    });

    const now = new Date();

    return invoices.map((invoice) => {
      const invoiceDate = new Date(invoice.invoicedate);
      const daysDiff = Math.floor(
        (now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceno,
        vendorName: invoice.vendor?.name || 'Unknown',
        totalAmount: invoice.total || 0,
        paidAmount: invoice.paidamount || 0,
        outstandingAmount: (invoice.total || 0) - (invoice.paidamount || 0),
        invoiceDate: invoice.invoicedate,
        daysOverdue: daysDiff - 30, // Assuming 30-day payment terms
      };
    });
  }

  private async getCategorySpending(): Promise<CategorySpendingDto[]> {
    const spending = await this.invoiceItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.product', 'product')
      .select('product.category', 'category')
      .addSelect('SUM(item.qty * item.ptr_cost)', 'totalspending')
      .addSelect('COUNT(item.id)', 'itemcount')
      .where('item.active = true')
      .groupBy('product.category')
      .orderBy('totalspending', 'DESC')
      .getRawMany();

    const totalSpending = spending.reduce(
      (sum, item) => sum + parseFloat(item.totalspending || 0),
      0,
    );

    return spending.map((item) => ({
      category: item.category || 'Uncategorized',
      totalSpending: parseFloat(item.totalspending || 0),
      percentage:
        totalSpending > 0
          ? Math.round(
              (parseFloat(item.totalspending || 0) / totalSpending) * 10000,
            ) / 100
          : 0,
      itemCount: parseInt(item.itemcount || 0),
    }));
  }

  private async getNearExpiryMetrics(): Promise<NearExpiryMetricsDto> {
    // Get batches for different thresholds in parallel
    const [batches30, batches60, batches90] = await Promise.all([
      this.batchAllocationService.getNearExpiryProducts(30),
      this.batchAllocationService.getNearExpiryProducts(60),
      this.batchAllocationService.getNearExpiryProducts(90),
    ]);

    // Calculate values
    const criticalValue = batches30.reduce(
      (sum, b) => sum + parseFloat(b.value_at_risk || 0),
      0,
    );
    const warningValue = batches60.reduce(
      (sum, b) => sum + parseFloat(b.value_at_risk || 0),
      0,
    );
    const watchValue = batches90.reduce(
      (sum, b) => sum + parseFloat(b.value_at_risk || 0),
      0,
    );

    // Note: batches60 includes batches30, batches90 includes batches60
    // So we need unique counts
    const uniqueBatches30 = new Set(batches30.map(b => b.batch_id));
    const uniqueBatches60 = new Set(batches60.map(b => b.batch_id));
    const uniqueBatches90 = new Set(batches90.map(b => b.batch_id));

    return {
      criticalCount: uniqueBatches30.size,
      criticalValue: Math.round(criticalValue * 100) / 100,
      warningCount: uniqueBatches60.size,
      warningValue: Math.round(warningValue * 100) / 100,
      watchCount: uniqueBatches90.size,
      watchValue: Math.round(watchValue * 100) / 100,
      totalCount: uniqueBatches90.size, // 90-day threshold includes all
      totalValue: Math.round(watchValue * 100) / 100, // 90-day value includes all
    };
  }
}
