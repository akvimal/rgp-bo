import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface SalaryStructure {
  id: number;
  userId: number;
  user: {
    id: number;
    fullname: string;
    email: string;
  };
  employmentTypeCode: string;
  roleCode: string;
  paymentModel: string;
  ctc: string;
  basicSalary: string;
  hra: string;
  conveyanceAllowance: string;
  medicalAllowance: string;
  specialAllowance: string;
  retainerAmount: string | null;
  perDayRate: string | null;
  hourlyRate: string | null;
  kpiEnabled: boolean;
  kpiIncentiveConfig: any;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  createdOn: string;
}

@Component({
  selector: 'app-salary-structure',
  templateUrl: './salary-structure.component.html',
  styleUrls: ['./salary-structure.component.css']
})
export class SalaryStructureComponent implements OnInit {
  private readonly API_URL = environment.apiHost;

  salaryStructures: SalaryStructure[] = [];
  filteredStructures: SalaryStructure[] = [];
  loading = false;

  // Filters
  searchText: string = '';
  selectedPaymentModel: string = 'ALL';
  selectedEmploymentType: string = 'ALL';
  showInactiveOnly: boolean = false;

  // Dropdown options
  paymentModelOptions = [
    { value: 'ALL', label: 'All Payment Models' },
    { value: 'MONTHLY_FIXED', label: 'Monthly Fixed' },
    { value: 'RETAINER_PLUS_PERDAY', label: 'Retainer + Per Day' },
    { value: 'HOURLY', label: 'Hourly' },
    { value: 'PROJECT_BASED', label: 'Project Based' },
    { value: 'DAILY_WAGE', label: 'Daily Wage' }
  ];

  employmentTypeOptions = [
    { value: 'ALL', label: 'All Types' },
    { value: 'FULLTIME', label: 'Full-time' },
    { value: 'PARTTIME', label: 'Part-time' },
    { value: 'CONTRACTUAL', label: 'Contractual' },
    { value: 'INTERN', label: 'Intern' }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSalaryStructures();
  }

  loadSalaryStructures(): void {
    this.loading = true;
    this.http.get<SalaryStructure[]>(`${this.API_URL}/payroll/salary-structures`).subscribe({
      next: (data) => {
        this.salaryStructures = data;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading salary structures:', error);
        // For now, show empty list
        this.salaryStructures = [];
        this.filteredStructures = [];
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredStructures = this.salaryStructures.filter(structure => {
      const matchesPaymentModel = this.selectedPaymentModel === 'ALL' ||
        structure.paymentModel === this.selectedPaymentModel;

      const matchesEmploymentType = this.selectedEmploymentType === 'ALL' ||
        structure.employmentTypeCode === this.selectedEmploymentType;

      const matchesSearch = !this.searchText ||
        structure.user.fullname.toLowerCase().includes(this.searchText.toLowerCase()) ||
        structure.user.email.toLowerCase().includes(this.searchText.toLowerCase());

      const matchesActive = this.showInactiveOnly ? !structure.active : structure.active;

      return matchesPaymentModel && matchesEmploymentType && matchesSearch && matchesActive;
    });
  }

  onPaymentModelChange(): void {
    this.applyFilters();
  }

  onEmploymentTypeChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onShowInactiveChange(): void {
    this.applyFilters();
  }

  createNewStructure(): void {
    // TODO: Navigate to create form when implemented
    alert('Create salary structure form will be implemented soon');
  }

  editStructure(structure: SalaryStructure): void {
    // TODO: Navigate to edit form when implemented
    alert(`Edit salary structure for ${structure.user.fullname}\n\nThis functionality will be implemented soon`);
  }

  viewHistory(userId: number): void {
    // TODO: Show salary history modal/page
    alert(`View salary history for user ${userId}\n\nThis functionality will be implemented soon`);
  }

  deactivateStructure(structure: SalaryStructure): void {
    if (!confirm(`Deactivate salary structure for ${structure.user.fullname}?\n\nThis will mark the structure as inactive.`)) {
      return;
    }
    // TODO: Implement deactivation API call
    alert('Deactivate functionality will be implemented soon');
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

  formatCurrency(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(num);
  }

  getStatusBadgeClass(active: boolean): string {
    return active ? 'badge-success' : 'badge-secondary';
  }

  getStatusLabel(active: boolean): string {
    return active ? 'Active' : 'Inactive';
  }

  calculateTotalFixedPay(structure: SalaryStructure): number {
    const basic = parseFloat(structure.basicSalary || '0');
    const hra = parseFloat(structure.hra || '0');
    const conveyance = parseFloat(structure.conveyanceAllowance || '0');
    const medical = parseFloat(structure.medicalAllowance || '0');
    const special = parseFloat(structure.specialAllowance || '0');
    return basic + hra + conveyance + medical + special;
  }

  isMonthlyFixed(model: string): boolean {
    return model === 'MONTHLY_FIXED';
  }

  isRetainerPlusPerDay(model: string): boolean {
    return model === 'RETAINER_PLUS_PERDAY';
  }

  isHourly(model: string): boolean {
    return model === 'HOURLY';
  }

  getTotalCTC(): number {
    return this.filteredStructures.reduce((sum, s) => sum + parseFloat(s.ctc), 0);
  }

  getTotalBasicSalary(): number {
    return this.filteredStructures.reduce((sum, s) => sum + parseFloat(s.basicSalary), 0);
  }
}
