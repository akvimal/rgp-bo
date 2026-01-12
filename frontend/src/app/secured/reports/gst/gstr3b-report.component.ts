import { Component, OnInit } from '@angular/core';
import { GstReportService, DateRange } from './gst-report.service';

@Component({
  selector: 'app-gstr3b-report',
  templateUrl: './gstr3b-report.component.html',
  styleUrls: ['./gstr3b-report.component.scss']
})
export class Gstr3bReportComponent implements OnInit {
  // Date range
  selectedMonth: Date = new Date();
  dateRange: DateRange;

  // Report data
  reportData: any = null;
  salesSummary: any[] = [];
  itcAvailable: any = null;
  gstSummary: any = null;

  // Loading state
  loading = false;

  constructor(private gstService: GstReportService) {
    this.dateRange = this.gstService.getPreviousMonthRange(); // GSTR-3B is for previous month
  }

  ngOnInit(): void {
    this.loadReport();
  }

  /**
   * Load complete GSTR-3B report
   */
  loadReport(): void {
    this.loading = true;
    this.gstService.getGstr3bComplete(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.reportData = data;
          this.salesSummary = data.table31 || [];
          this.itcAvailable = data.table4 || {};
          this.gstSummary = data.summary || {};
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading GSTR-3B report:', error);
          this.loading = false;
        }
      });
  }

  /**
   * Get previous month
   */
  previousMonth(): void {
    const current = this.selectedMonth;
    const newDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.selectedMonth = newDate;
    this.dateRange = this.gstService.getMonthRange(
      newDate.getFullYear(),
      newDate.getMonth() + 1
    );
    this.loadReport();
  }

  /**
   * Get next month
   */
  nextMonth(): void {
    const current = this.selectedMonth;
    const newDate = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.selectedMonth = newDate;
    this.dateRange = this.gstService.getMonthRange(
      newDate.getFullYear(),
      newDate.getMonth() + 1
    );
    this.loadReport();
  }

  /**
   * Get month display string
   */
  getMonthDisplay(): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[this.selectedMonth.getMonth()]} ${this.selectedMonth.getFullYear()}`;
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    if (!amount) return '₹0.00';
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Calculate net tax payable
   */
  getNetTaxPayable(): number {
    if (!this.gstSummary) return 0;
    return (this.gstSummary.sales?.totalTax || 0) - (this.gstSummary.purchases?.eligibleItc || 0);
  }

  /**
   * Get total output tax (all components)
   */
  getTotalOutputTax(): number {
    return this.salesSummary.reduce((sum, item) =>
      sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
  }

  /**
   * Get total ITC available (all components)
   */
  getTotalItcAvailable(): number {
    if (!this.itcAvailable) return 0;
    return (this.itcAvailable.totalCgst || 0) +
           (this.itcAvailable.totalSgst || 0) +
           (this.itcAvailable.totalIgst || 0);
  }

  /**
   * Get total CGST from sales
   */
  getTotalCgst(): number {
    return this.salesSummary.reduce((sum, item) => sum + (item.cgst_amount || 0), 0);
  }

  /**
   * Get total SGST from sales
   */
  getTotalSgst(): number {
    return this.salesSummary.reduce((sum, item) => sum + (item.sgst_amount || 0), 0);
  }

  /**
   * Get total IGST from sales
   */
  getTotalIgst(): number {
    return this.salesSummary.reduce((sum, item) => sum + (item.igst_amount || 0), 0);
  }

  /**
   * Get net CGST payable
   */
  getNetCgstPayable(): number {
    return this.getTotalCgst() - (this.itcAvailable?.totalCgst || 0);
  }

  /**
   * Get net SGST payable
   */
  getNetSgstPayable(): number {
    return this.getTotalSgst() - (this.itcAvailable?.totalSgst || 0);
  }

  /**
   * Get net IGST payable
   */
  getNetIgstPayable(): number {
    return this.getTotalIgst() - (this.itcAvailable?.totalIgst || 0);
  }

  /**
   * Export to CSV
   */
  exportToCsv(): void {
    // Export Table 3.1 - Sales Summary
    const salesData = this.salesSummary.map(item => ({
      'Tax Rate': item.tax_rate,
      'Taxable Value': item.total_taxable_value,
      'CGST': item.cgst_amount,
      'SGST': item.sgst_amount,
      'IGST': item.igst_amount,
      'Total Tax': (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0)
    }));
    this.gstService.exportToCsv(salesData, `GSTR3B_Table3.1_${this.dateRange.startDate}_${this.dateRange.endDate}.csv`);
  }

  /**
   * Refresh data
   */
  refresh(): void {
    this.loadReport();
  }
}
