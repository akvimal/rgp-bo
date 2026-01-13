import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PayrollService } from '../../services/payroll.service';
import { PayrollRun, MONTH_NAMES_SHORT } from '../../models/payroll.models';

@Component({
  selector: 'app-payroll-list',
  templateUrl: './payroll-list.component.html',
  styleUrls: ['./payroll-list.component.css']
})
export class PayrollListComponent implements OnInit {
  payrollRuns: PayrollRun[] = [];
  filteredRuns: PayrollRun[] = [];
  loading = false;

  // Filters
  selectedYear: number;
  selectedStatus: string = 'ALL';
  searchText: string = '';

  // Available years for dropdown
  availableYears: number[] = [];

  // Status options
  statusOptions = [
    { value: 'ALL', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'CALCULATED', label: 'Calculated' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'PAYMENT_REQUESTED', label: 'Payment Requested' },
    { value: 'COMPLETED', label: 'Completed' }
  ];

  constructor(
    private payrollService: PayrollService,
    private router: Router
  ) {
    const currentYear = new Date().getFullYear();
    this.selectedYear = currentYear;
    this.availableYears = [currentYear - 1, currentYear, currentYear + 1];
  }

  ngOnInit(): void {
    this.loadPayrollRuns();
  }

  loadPayrollRuns(): void {
    this.loading = true;
    this.payrollService.getAllPayrollRuns(this.selectedYear).subscribe({
      next: (data) => {
        this.payrollRuns = data;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payroll runs:', error);
        alert('Error loading payroll runs: ' + (error.error?.message || error.message));
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredRuns = this.payrollRuns.filter(run => {
      const matchesStatus = this.selectedStatus === 'ALL' || run.status === this.selectedStatus;
      const matchesSearch = !this.searchText ||
        run.title.toLowerCase().includes(this.searchText.toLowerCase()) ||
        run.description?.toLowerCase().includes(this.searchText.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }

  onYearChange(): void {
    this.loadPayrollRuns();
  }

  onStatusChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  createNewPayrollRun(): void {
    this.router.navigate(['/secure/payroll/create']);
  }

  viewDetails(runId: number): void {
    this.router.navigate(['/secure/payroll', runId, 'details']);
  }

  calculatePayroll(run: PayrollRun): void {
    if (!confirm(`Calculate payroll for ${run.title}?\n\nThis will process all employees with active salary structures.`)) {
      return;
    }

    this.loading = true;
    this.payrollService.calculatePayroll({ payrollRunId: run.id }).subscribe({
      next: (result) => {
        alert(
          `Payroll calculation completed!\n\n` +
          `Employees processed: ${result.successCount}\n` +
          `Total Gross: ${this.formatCurrency(result.totalGrossSalary)}\n` +
          `Total Net: ${this.formatCurrency(result.totalNetSalary)}`
        );
        this.loadPayrollRuns();
      },
      error: (error) => {
        console.error('Error calculating payroll:', error);
        alert('Error calculating payroll: ' + (error.error?.message || error.message));
        this.loading = false;
      }
    });
  }

  approvePayroll(run: PayrollRun): void {
    const remarks = prompt('Enter approval remarks (optional):');
    if (remarks === null) return; // User cancelled

    this.loading = true;
    this.payrollService.approvePayrollRun(run.id, remarks || undefined).subscribe({
      next: (result) => {
        alert(`Payroll run approved successfully!`);
        this.loadPayrollRuns();
      },
      error: (error) => {
        console.error('Error approving payroll:', error);
        alert('Error approving payroll: ' + (error.error?.message || error.message));
        this.loading = false;
      }
    });
  }

  deletePayrollRun(run: PayrollRun): void {
    if (!confirm(`Delete payroll run "${run.title}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    // TODO: Implement delete endpoint
    alert('Delete functionality not yet implemented on backend');
  }

  getMonthName(month: number): string {
    return MONTH_NAMES_SHORT[month - 1] || '';
  }

  getStatusBadgeClass(status: string): string {
    return this.payrollService.getStatusBadgeClass(status);
  }

  formatCurrency(value: string | number): string {
    return this.payrollService.formatCurrency(value);
  }

  canCalculate(status: string): boolean {
    return this.payrollService.canCalculate(status);
  }

  canApprove(status: string): boolean {
    return this.payrollService.canApprove(status);
  }

  getTotalEmployees(): number {
    return this.filteredRuns.reduce((sum, r) => sum + r.totalEmployees, 0);
  }

  getTotalGrossSalary(): number {
    return this.filteredRuns.reduce((sum, r) => sum + parseFloat(r.totalGrossSalary), 0);
  }

  getTotalDeductions(): number {
    return this.filteredRuns.reduce((sum, r) => sum + parseFloat(r.totalDeductions), 0);
  }

  getTotalNetSalary(): number {
    return this.filteredRuns.reduce((sum, r) => sum + parseFloat(r.totalNetSalary), 0);
  }
}
