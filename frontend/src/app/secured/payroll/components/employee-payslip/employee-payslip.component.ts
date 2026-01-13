import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PayrollService } from '../../services/payroll.service';
import { PayrollDetail, MONTH_NAMES } from '../../models/payroll.models';

@Component({
  selector: 'app-employee-payslip',
  templateUrl: './employee-payslip.component.html',
  styleUrls: ['./employee-payslip.component.css']
})
export class EmployeePayslipComponent implements OnInit {
  payslip: PayrollDetail | null = null;
  loading = false;
  payrollRunId: number;
  userId: number;

  // Breakdown arrays for display
  earningsArray: Array<{ name: string; amount: number }> = [];
  deductionsArray: Array<{ name: string; amount: number }> = [];
  employerContributionsArray: Array<{ name: string; amount: number }> = [];
  kpiBreakdownArray: Array<{ name: string; score: number }> = [];

  constructor(
    private payrollService: PayrollService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.payrollRunId = Number(this.route.snapshot.paramMap.get('payrollRunId'));
    this.userId = Number(this.route.snapshot.paramMap.get('userId'));
  }

  ngOnInit(): void {
    this.loadPayslip();
  }

  loadPayslip(): void {
    this.loading = true;
    this.payrollService.getEmployeePayslip(this.payrollRunId, this.userId).subscribe({
      next: (data) => {
        this.payslip = data;
        this.processBreakdowns();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payslip:', error);
        alert('Error loading payslip: ' + (error.error?.message || error.message));
        this.loading = false;
      }
    });
  }

  processBreakdowns(): void {
    if (!this.payslip) return;

    // Convert earnings object to array
    this.earningsArray = Object.entries(this.payslip.earningsBreakdown).map(([name, amount]) => ({
      name: this.formatComponentName(name),
      amount: amount
    }));

    // Convert deductions object to array
    this.deductionsArray = Object.entries(this.payslip.deductionsBreakdown).map(([name, amount]) => ({
      name: this.formatComponentName(name),
      amount: amount
    }));

    // Convert employer contributions object to array
    this.employerContributionsArray = Object.entries(this.payslip.employerContributions).map(([name, amount]) => ({
      name: this.formatComponentName(name),
      amount: amount
    }));

    // Convert KPI breakdown object to array
    if (this.payslip.kpiBreakdown) {
      this.kpiBreakdownArray = Object.entries(this.payslip.kpiBreakdown).map(([name, score]) => ({
        name: this.formatComponentName(name),
        score: score
      }));
    }
  }

  formatComponentName(name: string): string {
    // Convert snake_case or UPPER_CASE to Title Case
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  goBack(): void {
    this.router.navigate(['/secure/payroll', this.payrollRunId, 'details']);
  }

  printPayslip(): void {
    window.print();
  }

  downloadPDF(): void {
    // TODO: Implement PDF download functionality
    alert('PDF download functionality will be implemented soon');
  }

  sendEmail(): void {
    if (!this.payslip) return;
    // TODO: Implement email sending functionality
    alert(`Email payslip to ${this.payslip.user.email}?\n\nThis functionality will be implemented soon`);
  }

  getMonthName(month: number): string {
    return MONTH_NAMES[month - 1] || '';
  }

  formatCurrency(value: string | number): string {
    return this.payrollService.formatCurrency(value);
  }

  getPaymentModelLabel(model: string): string {
    const labels: Record<string, string> = {
      'MONTHLY_FIXED': 'Monthly Fixed Salary',
      'RETAINER_PLUS_PERDAY': 'Retainer + Per Day',
      'HOURLY': 'Hourly Rate',
      'PROJECT_BASED': 'Project Based',
      'DAILY_WAGE': 'Daily Wage'
    };
    return labels[model] || model;
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

  getTotalEarnings(): number {
    return this.earningsArray.reduce((sum, item) => sum + item.amount, 0);
  }

  getTotalDeductions(): number {
    return this.deductionsArray.reduce((sum, item) => sum + item.amount, 0);
  }

  getTotalEmployerContributions(): number {
    return this.employerContributionsArray.reduce((sum, item) => sum + item.amount, 0);
  }

  getAverageKPIScore(): number {
    if (this.kpiBreakdownArray.length === 0) return 0;
    const total = this.kpiBreakdownArray.reduce((sum, item) => sum + item.score, 0);
    return total / this.kpiBreakdownArray.length;
  }

  hasKpiIncentive(): boolean {
    if (!this.payslip || !this.payslip.kpiIncentiveAmount) return false;
    return parseFloat(this.payslip.kpiIncentiveAmount) > 0;
  }
}
