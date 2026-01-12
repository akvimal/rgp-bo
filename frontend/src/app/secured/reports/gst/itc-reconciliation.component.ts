import { Component, OnInit } from '@angular/core';
import { GstReportService, DateRange, ItcStatusUpdate } from './gst-report.service';

@Component({
  selector: 'app-itc-reconciliation',
  templateUrl: './itc-reconciliation.component.html',
  styleUrls: ['./itc-reconciliation.component.scss']
})
export class ItcReconciliationComponent implements OnInit {
  // Date range
  selectedMonth: Date = new Date();
  dateRange: DateRange;

  // Data
  purchaseReconciliation: any[] = [];
  vendorWiseItc: any[] = [];
  paymentRisk: any[] = [];

  // Loading states
  loadingReconciliation = false;
  loadingVendorItc = false;
  loadingPaymentRisk = false;

  // Selection
  selectedInvoices: number[] = [];
  selectAll = false;

  // Active tab
  activeTab: 'reconciliation' | 'vendor-itc' | 'payment-risk' = 'reconciliation';

  // Action in progress
  actionInProgress = false;

  constructor(private gstService: GstReportService) {
    this.dateRange = this.gstService.getCurrentMonthRange();
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  /**
   * Load all reconciliation data
   */
  loadAllData(): void {
    this.loadPurchaseReconciliation();
    this.loadVendorWiseItc();
    this.loadPaymentRisk();
  }

  /**
   * Load purchase reconciliation data
   */
  loadPurchaseReconciliation(): void {
    this.loadingReconciliation = true;
    this.gstService.getPurchaseReconciliation(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.purchaseReconciliation = data;
          this.loadingReconciliation = false;
        },
        error: (error) => {
          console.error('Error loading purchase reconciliation:', error);
          this.loadingReconciliation = false;
        }
      });
  }

  /**
   * Load vendor-wise ITC summary
   */
  loadVendorWiseItc(): void {
    this.loadingVendorItc = true;
    this.gstService.getVendorWiseItc(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (data) => {
          this.vendorWiseItc = data;
          this.loadingVendorItc = false;
        },
        error: (error) => {
          console.error('Error loading vendor-wise ITC:', error);
          this.loadingVendorItc = false;
        }
      });
  }

  /**
   * Load payment risk data
   */
  loadPaymentRisk(): void {
    this.loadingPaymentRisk = true;
    this.gstService.getItcPaymentRisk()
      .subscribe({
        next: (data) => {
          this.paymentRisk = data;
          this.loadingPaymentRisk = false;
        },
        error: (error) => {
          console.error('Error loading payment risk:', error);
          this.loadingPaymentRisk = false;
        }
      });
  }

  /**
   * Handle month change
   */
  previousMonth(): void {
    const current = this.selectedMonth;
    const newDate = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    this.selectedMonth = newDate;
    this.dateRange = this.gstService.getMonthRange(
      newDate.getFullYear(),
      newDate.getMonth() + 1
    );
    this.loadAllData();
  }

  nextMonth(): void {
    const current = this.selectedMonth;
    const newDate = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    this.selectedMonth = newDate;
    this.dateRange = this.gstService.getMonthRange(
      newDate.getFullYear(),
      newDate.getMonth() + 1
    );
    this.loadAllData();
  }

  /**
   * Get month display
   */
  getMonthDisplay(): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[this.selectedMonth.getMonth()]} ${this.selectedMonth.getFullYear()}`;
  }

  /**
   * Set active tab
   */
  setActiveTab(tab: 'reconciliation' | 'vendor-itc' | 'payment-risk'): void {
    this.activeTab = tab;
    this.selectedInvoices = [];
    this.selectAll = false;
  }

  /**
   * Toggle invoice selection
   */
  toggleInvoiceSelection(invoiceId: number): void {
    const index = this.selectedInvoices.indexOf(invoiceId);
    if (index > -1) {
      this.selectedInvoices.splice(index, 1);
    } else {
      this.selectedInvoices.push(invoiceId);
    }
    this.updateSelectAllState();
  }

  /**
   * Toggle select all
   */
  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedInvoices = [];
    } else {
      this.selectedInvoices = this.purchaseReconciliation.map(item => item.id);
    }
    this.selectAll = !this.selectAll;
  }

  /**
   * Update select all state
   */
  updateSelectAllState(): void {
    this.selectAll = this.selectedInvoices.length === this.purchaseReconciliation.length &&
                     this.purchaseReconciliation.length > 0;
  }

  /**
   * Check if invoice is selected
   */
  isInvoiceSelected(invoiceId: number): boolean {
    return this.selectedInvoices.includes(invoiceId);
  }

  /**
   * Mark selected as GSTR-2B verified
   */
  markAsGstr2bVerified(): void {
    if (this.selectedInvoices.length === 0) {
      alert('Please select at least one invoice');
      return;
    }

    if (!confirm(`Mark ${this.selectedInvoices.length} invoice(s) as GSTR-2B verified?`)) {
      return;
    }

    this.actionInProgress = true;
    this.gstService.markGstr2bVerified(this.selectedInvoices)
      .subscribe({
        next: (result) => {
          alert(`Successfully marked ${result.updated} invoice(s) as GSTR-2B verified`);
          this.selectedInvoices = [];
          this.selectAll = false;
          this.loadPurchaseReconciliation();
          this.actionInProgress = false;
        },
        error: (error) => {
          console.error('Error marking invoices:', error);
          alert('Failed to mark invoices as verified');
          this.actionInProgress = false;
        }
      });
  }

  /**
   * Mark selected as ITC eligible
   */
  markAsItcEligible(): void {
    if (this.selectedInvoices.length === 0) {
      alert('Please select at least one invoice');
      return;
    }

    if (!confirm(`Mark ${this.selectedInvoices.length} invoice(s) as ITC Eligible?`)) {
      return;
    }

    const update: ItcStatusUpdate = {
      invoiceIds: this.selectedInvoices,
      status: 'ITC_ELIGIBLE'
    };

    this.actionInProgress = true;
    this.gstService.updateItcStatus(update)
      .subscribe({
        next: (result) => {
          alert(`Successfully marked ${result.updated} invoice(s) as ITC Eligible`);
          this.selectedInvoices = [];
          this.selectAll = false;
          this.loadPurchaseReconciliation();
          this.actionInProgress = false;
        },
        error: (error) => {
          console.error('Error updating ITC status:', error);
          alert('Failed to update ITC status');
          this.actionInProgress = false;
        }
      });
  }

  /**
   * Bulk claim ITC for selected month
   */
  bulkClaimItc(): void {
    if (!confirm(`Claim ITC for all eligible invoices in ${this.getMonthDisplay()}?`)) {
      return;
    }

    this.actionInProgress = true;
    this.gstService.bulkClaimItc(this.dateRange.startDate, this.dateRange.endDate)
      .subscribe({
        next: (result) => {
          alert(`Successfully claimed ITC for ${result.claimed} invoice(s)\nTotal ITC: ₹${result.totalItc.toFixed(2)}`);
          this.loadPurchaseReconciliation();
          this.actionInProgress = false;
        },
        error: (error) => {
          console.error('Error claiming ITC:', error);
          alert('Failed to claim ITC');
          this.actionInProgress = false;
        }
      });
  }

  /**
   * Export reconciliation to CSV
   */
  exportReconciliationToCsv(): void {
    const data = this.purchaseReconciliation.map(item => ({
      'Invoice No': item.invoice_no,
      'Vendor GSTIN': item.vendor_gstin,
      'Vendor Name': item.vendor_name,
      'Invoice Date': this.formatDate(item.invoice_date),
      'Invoice Value': item.total,
      'CGST': item.cgst_amount,
      'SGST': item.sgst_amount,
      'IGST': item.igst_amount,
      'Total ITC': item.total_itc,
      'ITC Status': item.tax_status,
      'GSTR-2B Verified': item.gstr2b_verified ? 'Yes' : 'No',
      'Payment Status': item.payment_status
    }));
    this.gstService.exportToCsv(data, `ITC_Reconciliation_${this.dateRange.startDate}_${this.dateRange.endDate}.csv`);
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
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    if (!status) return 'badge-secondary';
    if (status === 'ITC_CLAIMED') return 'badge-success';
    if (status === 'ITC_ELIGIBLE') return 'badge-primary';
    if (status === 'ITC_INELIGIBLE') return 'badge-danger';
    if (status === 'PENDING') return 'badge-warning';
    return 'badge-secondary';
  }

  /**
   * Get risk badge class
   */
  getRiskBadgeClass(status: string): string {
    if (status?.includes('OVERDUE')) return 'badge-danger';
    if (status?.includes('CRITICAL')) return 'badge-warning';
    if (status?.includes('WARNING')) return 'badge-info';
    return 'badge-success';
  }

  /**
   * Refresh data
   */
  refresh(): void {
    this.loadAllData();
  }
}
