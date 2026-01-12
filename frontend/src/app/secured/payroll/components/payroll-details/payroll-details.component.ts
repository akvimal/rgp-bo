import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PayrollService } from '../../services/payroll.service';
import { PayrollRunWithDetails, PayrollDetail, MONTH_NAMES } from '../../models/payroll.models';

@Component({
  selector: 'app-payroll-details',
  templateUrl: './payroll-details.component.html',
  styleUrls: ['./payroll-details.component.css']
})
export class PayrollDetailsComponent implements OnInit {
  payrollRun: PayrollRunWithDetails | null = null;
  loading = false;
  payrollRunId: number;

  // Filters
  searchText: string = '';
  selectedPaymentStatus: string = 'ALL';
  filteredDetails: PayrollDetail[] = [];

  // Payment status options
  paymentStatusOptions = [
    { value: 'ALL', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'REQUESTED', label: 'Requested' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'PAID', label: 'Paid' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'ON_HOLD', label: 'On Hold' }
  ];

  constructor(
    private payrollService: PayrollService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.payrollRunId = Number(this.route.snapshot.paramMap.get('id'));
  }

  ngOnInit(): void {
    this.loadPayrollDetails();
  }

  loadPayrollDetails(): void {
    this.loading = true;
    this.payrollService.getPayrollRunWithDetails(this.payrollRunId).subscribe({
      next: (data) => {
        this.payrollRun = data;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payroll details:', error);
        alert('Error loading payroll details: ' + (error.error?.message || error.message));
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    if (!this.payrollRun) return;

    this.filteredDetails = this.payrollRun.details.filter(detail => {
      const matchesStatus = this.selectedPaymentStatus === 'ALL' || detail.paymentStatus === this.selectedPaymentStatus;
      const matchesSearch = !this.searchText ||
        detail.user.fullname.toLowerCase().includes(this.searchText.toLowerCase()) ||
        detail.user.email.toLowerCase().includes(this.searchText.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }

  onPaymentStatusChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  goBack(): void {
    this.router.navigate(['/secure/payroll']);
  }

  viewPayslip(detail: PayrollDetail): void {
    this.router.navigate(['/secure/payroll', this.payrollRunId, 'employee', detail.userId, 'payslip']);
  }

  approvePayroll(): void {
    if (!this.payrollRun) return;

    const remarks = prompt('Enter approval remarks (optional):');
    if (remarks === null) return; // User cancelled

    this.loading = true;
    this.payrollService.approvePayrollRun(this.payrollRunId, remarks || undefined).subscribe({
      next: () => {
        alert('Payroll run approved successfully!');
        this.loadPayrollDetails();
      },
      error: (error) => {
        console.error('Error approving payroll:', error);
        alert('Error approving payroll: ' + (error.error?.message || error.message));
        this.loading = false;
      }
    });
  }

  requestPayment(): void {
    if (!this.payrollRun) return;
    // TODO: Implement payment request functionality
    alert('Payment request functionality will be implemented soon');
  }

  exportToExcel(): void {
    if (!this.payrollRun) return;
    // TODO: Implement Excel export functionality
    alert('Excel export functionality will be implemented soon');
  }

  exportToPDF(): void {
    if (!this.payrollRun) return;
    // TODO: Implement PDF export functionality
    alert('PDF export functionality will be implemented soon');
  }

  getMonthName(month: number): string {
    return MONTH_NAMES[month - 1] || '';
  }

  getStatusBadgeClass(status: string): string {
    return this.payrollService.getStatusBadgeClass(status);
  }

  getPaymentStatusBadgeClass(status: string): string {
    const statusClasses: Record<string, string> = {
      'PENDING': 'badge-secondary',
      'REQUESTED': 'badge-info',
      'APPROVED': 'badge-primary',
      'PROCESSING': 'badge-warning',
      'PAID': 'badge-success',
      'FAILED': 'badge-danger',
      'ON_HOLD': 'badge-warning'
    };
    return statusClasses[status] || 'badge-secondary';
  }

  formatCurrency(value: string | number): string {
    return this.payrollService.formatCurrency(value);
  }

  canApprove(): boolean {
    return this.payrollRun?.status === 'CALCULATED';
  }

  canRequestPayment(): boolean {
    return this.payrollRun?.status === 'APPROVED';
  }

  getPaymentModelLabel(model: string): string {
    const labels: Record<string, string> = {
      'MONTHLY_FIXED': 'Monthly Fixed',
      'RETAINER_PLUS_PERDAY': 'Retainer + Per Day',
      'HOURLY': 'Hourly',
      'PROJECT_BASED': 'Project Based',
      'DAILY_WAGE': 'Daily Wage'
    };
    return labels[model] || model;
  }

  getEarningsTotal(detail: PayrollDetail): number {
    return Object.values(detail.earningsBreakdown).reduce((sum, val) => sum + val, 0);
  }

  getDeductionsTotal(detail: PayrollDetail): number {
    return Object.values(detail.deductionsBreakdown).reduce((sum, val) => sum + val, 0);
  }

  getEmployerContributionsTotal(detail: PayrollDetail): number {
    return Object.values(detail.employerContributions).reduce((sum, val) => sum + val, 0);
  }

  getTotalGrossSalary(): number {
    return this.filteredDetails.reduce((sum, d) => sum + parseFloat(d.grossSalary), 0);
  }

  getTotalDeductions(): number {
    return this.filteredDetails.reduce((sum, d) => sum + parseFloat(d.totalDeductions), 0);
  }

  getTotalNetSalary(): number {
    return this.filteredDetails.reduce((sum, d) => sum + parseFloat(d.netSalary), 0);
  }

  getTotalKpiIncentive(): number {
    return this.filteredDetails.reduce((sum, d) => sum + parseFloat(d.kpiIncentiveAmount || '0'), 0);
  }

  hasKpiIncentive(kpiAmount: string | null): boolean {
    if (!kpiAmount) return false;
    return parseFloat(kpiAmount) > 0;
  }
}
