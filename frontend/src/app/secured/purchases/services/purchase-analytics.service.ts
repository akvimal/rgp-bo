import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PurchaseSummary {
  totalPurchaseValueCurrentMonth: number;
  totalPurchaseValuePreviousMonth: number;
  percentageChange: number;
  pendingInvoicesCount: number;
  pendingInvoicesValue: number;
  approvedPaidCount: number;
  approvedPaidValue: number;
  topVendorName: string;
  topVendorValue: number;
  totalInvoicesThisMonth: number;
  averageInvoiceValue: number;
}

export interface MonthlyTrend {
  month: string;
  totalValue: number;
  invoiceCount: number;
}

export interface InvoiceStatusBreakdown {
  status: string;
  count: number;
  totalValue: number;
  percentage: number;
}

export interface VendorAnalysis {
  vendorId: number;
  vendorName: string;
  totalPurchaseValue: number;
  invoiceCount: number;
  averageInvoiceValue: number;
  outstandingAmount: number;
}

export interface RecentInvoice {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  vendorName: string;
  total: number;
  status: string;
  paymentStatus: string;
  lifecycleStatus: string;
}

export interface PaymentTimeline {
  invoiceId: number;
  invoiceNo: string;
  vendorName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  invoiceDate: string;
  daysOverdue: number;
}

export interface CategorySpending {
  category: string;
  totalSpending: number;
  percentage: number;
  itemCount: number;
}

export interface NearExpiryMetrics {
  criticalCount: number;
  criticalValue: number;
  warningCount: number;
  warningValue: number;
  watchCount: number;
  watchValue: number;
  totalCount: number;
  totalValue: number;
}

export interface PurchaseAnalytics {
  summary: PurchaseSummary;
  monthlyTrends: MonthlyTrend[];
  statusBreakdown: InvoiceStatusBreakdown[];
  topVendors: VendorAnalysis[];
  recentInvoices: RecentInvoice[];
  paymentTimeline: PaymentTimeline[];
  categorySpending: CategorySpending[];
  nearExpiryMetrics: NearExpiryMetrics;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseAnalyticsService {
  private apiUrl = `${environment.apiHost}/analytics/purchases`;

  constructor(private http: HttpClient) {}

  getAnalytics(): Observable<PurchaseAnalytics> {
    return this.http.get<PurchaseAnalytics>(this.apiUrl);
  }
}
