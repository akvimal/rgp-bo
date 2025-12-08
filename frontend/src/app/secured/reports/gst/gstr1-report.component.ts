import { Component, OnInit } from '@angular/core';
import { GstReportService, DateRange } from './gst-report.service';

@Component({
  selector: 'app-gstr1-report',
  templateUrl: './gstr1-report.component.html',
  styleUrls: ['./gstr1-report.component.scss']
})
export class Gstr1ReportComponent implements OnInit {
  // Date range
  selectedMonth: Date = new Date();
  dateRange: DateRange;

  // Report data
  b2bSales: any[] = [];
  b2cLarge: any[] = [];
  b2cSmall: any[] = [];
  hsnSummary: any[] = [];

  // Loading states
  loadingB2b = false;
  loadingB2cLarge = false;
  loadingB2cSmall = false;
  loadingHsn = false;

  // Active tab
  activeTab: 'b2b' | 'b2c-large' | 'b2c-small' | 'hsn' = 'b2b';

  constructor(private gstService: GstReportService) {
    this.dateRange = this.gstService.getPreviousMonthRange(); // GSTR-1 is for previous month
  }

  ngOnInit(): void {
    this.loadAllReports();
  }

  /**
   * Load all GSTR-1 reports
   */
  loadAllReports(): void {
    this.loadB2bSales();
    this.loadB2cLarge();
    this.loadB2cSmall();
    this.loadHsnSummary();
  }

  /**
   * Load B2B sales report
   */
  loadB2bSales(): void {
    this.loadingB2b = true;
    this.gstService.getGstr1B2bSales(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.b2bSales = data;
          this.loadingB2b = false;
        },
        error: (error) => {
          console.error('Error loading B2B sales:', error);
          this.loadingB2b = false;
        }
      });
  }

  /**
   * Load B2C large sales report
   */
  loadB2cLarge(): void {
    this.loadingB2cLarge = true;
    this.gstService.getGstr1B2cLarge(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.b2cLarge = data;
          this.loadingB2cLarge = false;
        },
        error: (error) => {
          console.error('Error loading B2C large:', error);
          this.loadingB2cLarge = false;
        }
      });
  }

  /**
   * Load B2C small sales summary
   */
  loadB2cSmall(): void {
    this.loadingB2cSmall = true;
    this.gstService.getGstr1B2cSmall(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.b2cSmall = data;
          this.loadingB2cSmall = false;
        },
        error: (error) => {
          console.error('Error loading B2C small:', error);
          this.loadingB2cSmall = false;
        }
      });
  }

  /**
   * Load HSN summary
   */
  loadHsnSummary(): void {
    this.loadingHsn = true;
    this.gstService.getGstr1HsnSummary(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.hsnSummary = data;
          this.loadingHsn = false;
        },
        error: (error) => {
          console.error('Error loading HSN summary:', error);
          this.loadingHsn = false;
        }
      });
  }

  /**
   * Handle month change
   */
  onMonthChange(): void {
    this.loadAllReports();
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
    this.loadAllReports();
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
    this.loadAllReports();
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
   * Set active tab
   */
  setActiveTab(tab: 'b2b' | 'b2c-large' | 'b2c-small' | 'hsn'): void {
    this.activeTab = tab;
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    if (!amount) return '₹0.00';
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN');
  }

  /**
   * Get total taxable value for B2B
   */
  getB2bTotalTaxableValue(): number {
    return this.b2bSales.reduce((sum, item) => sum + (item.taxable_value || 0), 0);
  }

  /**
   * Get total tax for B2B
   */
  getB2bTotalTax(): number {
    return this.b2bSales.reduce((sum, item) =>
      sum + (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0), 0);
  }

  /**
   * Get total invoice value for B2B
   */
  getB2bTotalInvoiceValue(): number {
    return this.b2bSales.reduce((sum, item) => sum + (item.invoice_value || 0), 0);
  }

  /**
   * Export B2B to CSV
   */
  exportB2bToCsv(): void {
    const data = this.b2bSales.map(item => ({
      'GSTIN': item.customer_gstin,
      'Customer Name': item.customer_name,
      'Invoice Number': item.bill_no,
      'Invoice Date': this.formatDate(item.sale_date),
      'Taxable Value': item.taxable_value,
      'Tax Rate': item.tax_rate,
      'CGST': item.cgst_amount,
      'SGST': item.sgst_amount,
      'IGST': item.igst_amount,
      'Invoice Value': item.invoice_value
    }));
    this.gstService.exportToCsv(data, `GSTR1_B2B_${this.dateRange.startDate}_${this.dateRange.endDate}.csv`);
  }

  /**
   * Export B2C Large to CSV
   */
  exportB2cLargeToCsv(): void {
    const data = this.b2cLarge.map(item => ({
      'Invoice Number': item.bill_no,
      'Invoice Date': this.formatDate(item.sale_date),
      'Taxable Value': item.taxable_value,
      'Tax Rate': item.tax_rate,
      'CGST': item.cgst_amount,
      'SGST': item.sgst_amount,
      'IGST': item.igst_amount,
      'Invoice Value': item.invoice_value
    }));
    this.gstService.exportToCsv(data, `GSTR1_B2C_Large_${this.dateRange.startDate}_${this.dateRange.endDate}.csv`);
  }

  /**
   * Export B2C Small to CSV
   */
  exportB2cSmallToCsv(): void {
    const data = this.b2cSmall;
    this.gstService.exportToCsv(data, `GSTR1_B2C_Small_${this.dateRange.startDate}_${this.dateRange.endDate}.csv`);
  }

  /**
   * Export HSN to CSV
   */
  exportHsnToCsv(): void {
    const data = this.hsnSummary.map(item => ({
      'HSN Code': item.hsn_code,
      'Description': item.description,
      'UQC': item.uqc,
      'Total Quantity': item.total_quantity,
      'Taxable Value': item.taxable_value,
      'Tax Rate': item.tax_rate,
      'CGST': item.cgst_amount,
      'SGST': item.sgst_amount,
      'IGST': item.igst_amount
    }));
    this.gstService.exportToCsv(data, `GSTR1_HSN_Summary_${this.dateRange.startDate}_${this.dateRange.endDate}.csv`);
  }

  /**
   * Refresh all data
   */
  refresh(): void {
    this.loadAllReports();
  }
}
