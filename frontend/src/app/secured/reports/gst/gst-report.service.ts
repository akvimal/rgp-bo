import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ItcStatusUpdate {
  invoiceIds: number[];
  status: 'ITC_ELIGIBLE' | 'ITC_INELIGIBLE' | 'ITC_CLAIMED' | 'ITC_REVERSED';
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GstReportService {
  private apiUrl = `${environment.apiHost}/gst-reports`;

  constructor(private http: HttpClient) {}

  // ============================================================================
  // GSTR-1 Reports (Sales)
  // ============================================================================

  /**
   * Get GSTR-1 B2B Sales Report (Table 4)
   */
  getGstr1B2bSales(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr1/b2b`, { params });
  }

  /**
   * Get GSTR-1 B2C Large Sales Report (Table 6C) - Invoices > ₹2.5 Lakhs
   */
  getGstr1B2cLarge(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr1/b2c-large`, { params });
  }

  /**
   * Get GSTR-1 B2C Small Sales Summary (Table 7) - Invoices ≤ ₹2.5 Lakhs
   */
  getGstr1B2cSmall(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr1/b2c-small`, { params });
  }

  /**
   * Get GSTR-1 HSN Summary (Table 12)
   */
  getGstr1HsnSummary(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr1/hsn-summary`, { params });
  }

  /**
   * Get Complete GSTR-1 Report (All Tables)
   */
  getGstr1Complete(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr1/complete`, { params });
  }

  // ============================================================================
  // GSTR-3B Reports (Summary)
  // ============================================================================

  /**
   * Get GSTR-3B Sales Summary by Tax Rate (Table 3.1)
   */
  getGstr3bSalesSummary(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr3b/sales-summary`, { params });
  }

  /**
   * Get GSTR-3B ITC Available (Table 4)
   */
  getGstr3bItcAvailable(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr3b/itc-available`, { params });
  }

  /**
   * Get Complete GSTR-3B Report Data
   */
  getGstr3bComplete(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/gstr3b/complete`, { params });
  }

  // ============================================================================
  // Purchase & ITC Reports
  // ============================================================================

  /**
   * Get Purchase Reconciliation Report (for GSTR-2B comparison)
   */
  getPurchaseReconciliation(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/purchases/reconciliation`, { params });
  }

  /**
   * Get Vendor-wise ITC Summary
   */
  getVendorWiseItc(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/purchases/vendor-wise-itc`, { params });
  }

  /**
   * Get ITC Dashboard - Monthly Summary
   */
  getItcDashboard(): Observable<any> {
    return this.http.get(`${this.apiUrl}/itc/dashboard`);
  }

  /**
   * Get ITC Payment Risk Report - Invoices at risk of ITC reversal
   */
  getItcPaymentRisk(): Observable<any> {
    return this.http.get(`${this.apiUrl}/itc/payment-risk`);
  }

  // ============================================================================
  // ITC Management Operations
  // ============================================================================

  /**
   * Update ITC status for invoices
   */
  updateItcStatus(data: ItcStatusUpdate): Observable<any> {
    return this.http.put(`${this.apiUrl}/itc/update-status`, data);
  }

  /**
   * Mark invoices as verified in GSTR-2B
   */
  markGstr2bVerified(invoiceIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/itc/mark-gstr2b-verified`, { invoiceIds });
  }

  /**
   * Bulk claim ITC for a month
   */
  bulkClaimItc(startDate: string, endDate: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/itc/bulk-claim`, { startDate, endDate });
  }

  // ============================================================================
  // Summary & Dashboard
  // ============================================================================

  /**
   * Get GST Summary for Dashboard
   */
  getGstSummary(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/summary`, { params });
  }

  /**
   * Get Missing Data Report (validation)
   */
  getMissingDataReport(startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/validation/missing-data`, { params });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get month start and end dates
   */
  getMonthRange(year: number, month: number): DateRange {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  }

  /**
   * Get current month range
   */
  getCurrentMonthRange(): DateRange {
    const now = new Date();
    return this.getMonthRange(now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Get previous month range
   */
  getPreviousMonthRange(): DateRange {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return this.getMonthRange(year, prevMonth);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Export data to CSV (client-side)
   */
  exportToCsv(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
