import { Component, OnInit } from '@angular/core';
import { GstReportService, DateRange } from './gst-report.service';

@Component({
  selector: 'app-gst-dashboard',
  templateUrl: './gst-dashboard.component.html',
  styleUrls: ['./gst-dashboard.component.scss']
})
export class GstDashboardComponent implements OnInit {
  // Date range
  selectedMonth: Date = new Date();
  dateRange: DateRange;

  // Summary data
  gstSummary: any = null;
  itcDashboard: any[] = [];
  itcPaymentRisk: any[] = [];
  missingData: any = null;

  // Loading states
  loadingSummary = false;
  loadingItcDashboard = false;
  loadingPaymentRisk = false;
  loadingMissingData = false;

  // Display states
  showPaymentRiskDetails = false;
  showMissingDataDetails = false;

  constructor(private gstService: GstReportService) {
    this.dateRange = this.gstService.getCurrentMonthRange();
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  /**
   * Load all dashboard data
   */
  loadAllData(): void {
    this.loadGstSummary();
    this.loadItcDashboard();
    this.loadPaymentRisk();
    this.loadMissingData();
  }

  /**
   * Load GST summary for selected month
   */
  loadGstSummary(): void {
    this.loadingSummary = true;
    this.gstService.getGstSummary(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.gstSummary = data;
          this.loadingSummary = false;
        },
        error: (error) => {
          console.error('Error loading GST summary:', error);
          this.loadingSummary = false;
        }
      });
  }

  /**
   * Load ITC dashboard (last 12 months)
   */
  loadItcDashboard(): void {
    this.loadingItcDashboard = true;
    this.gstService.getItcDashboard()
      .subscribe({
        next: (data) => {
          this.itcDashboard = data;
          this.loadingItcDashboard = false;
        },
        error: (error) => {
          console.error('Error loading ITC dashboard:', error);
          this.loadingItcDashboard = false;
        }
      });
  }

  /**
   * Load payment risk invoices
   */
  loadPaymentRisk(): void {
    this.loadingPaymentRisk = true;
    this.gstService.getItcPaymentRisk()
      .subscribe({
        next: (data) => {
          this.itcPaymentRisk = data;
          this.loadingPaymentRisk = false;
        },
        error: (error) => {
          console.error('Error loading payment risk:', error);
          this.loadingPaymentRisk = false;
        }
      });
  }

  /**
   * Load missing data report for selected month
   */
  loadMissingData(): void {
    this.loadingMissingData = true;
    this.gstService.getMissingDataReport(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.missingData = data;
          this.loadingMissingData = false;
        },
        error: (error) => {
          console.error('Error loading missing data report:', error);
          this.loadingMissingData = false;
        }
      });
  }

  /**
   * Handle month change
   */
  onMonthChange(event: any): void {
    const date = new Date(event.target.value);
    this.selectedMonth = date;
    this.dateRange = this.gstService.getMonthRange(
      date.getFullYear(),
      date.getMonth() + 1
    );
    this.loadGstSummary();
    this.loadMissingData();
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
    this.loadGstSummary();
    this.loadMissingData();
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
    this.loadGstSummary();
    this.loadMissingData();
  }

  /**
   * Get current month
   */
  currentMonth(): void {
    this.selectedMonth = new Date();
    this.dateRange = this.gstService.getCurrentMonthRange();
    this.loadGstSummary();
    this.loadMissingData();
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
   * Get risk status badge class
   */
  getRiskBadgeClass(status: string): string {
    if (status?.includes('OVERDUE')) return 'badge-danger';
    if (status?.includes('CRITICAL')) return 'badge-warning';
    if (status?.includes('WARNING')) return 'badge-info';
    return 'badge-success';
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
   * Toggle payment risk details
   */
  togglePaymentRiskDetails(): void {
    this.showPaymentRiskDetails = !this.showPaymentRiskDetails;
  }

  /**
   * Toggle missing data details
   */
  toggleMissingDataDetails(): void {
    this.showMissingDataDetails = !this.showMissingDataDetails;
  }

  /**
   * Get critical payment risk count
   */
  getCriticalRiskCount(): number {
    return this.itcPaymentRisk.filter(item =>
      item.risk_status?.includes('OVERDUE') || item.risk_status?.includes('CRITICAL')
    ).length;
  }

  /**
   * Get total ITC at risk
   */
  getTotalItcAtRisk(): number {
    return this.itcPaymentRisk.reduce((sum, item) => sum + (item.total_itc_at_risk || 0), 0);
  }

  /**
   * Get missing data count
   */
  getMissingDataCount(): number {
    if (!this.missingData) return 0;
    return (this.missingData.salesMissingCustomerGstin?.length || 0) +
           (this.missingData.purchasesMissingVendorGstin?.length || 0) +
           (this.missingData.productsMissingHsn?.length || 0);
  }

  /**
   * Refresh all data
   */
  refresh(): void {
    this.loadAllData();
  }
}
