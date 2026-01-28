import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EnrollmentsService } from '../services/enrollments.service';
import { EmployeeBenefitEnrollment, EnrollmentStatus, EnrollmentType } from '../models/hr.models';

interface StatusCount {
  status: EnrollmentStatus;
  count: number;
  label: string;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-my-benefits',
  templateUrl: './my-benefits.component.html',
  styleUrls: ['./my-benefits.component.scss']
})
export class MyBenefitsComponent implements OnInit {
  // Enrollments data
  enrollments: EmployeeBenefitEnrollment[] = [];
  allEnrollments: EmployeeBenefitEnrollment[] = [];
  selectedEnrollment: EmployeeBenefitEnrollment | null = null;

  // Status counts
  statusCounts: StatusCount[] = [
    { status: EnrollmentStatus.PENDING, count: 0, label: 'Pending', color: '#ffc107', icon: 'pi-clock' },
    { status: EnrollmentStatus.ACTIVE, count: 0, label: 'Active', color: '#28a745', icon: 'pi-check-circle' },
    { status: EnrollmentStatus.CANCELLED, count: 0, label: 'Cancelled', color: '#dc3545', icon: 'pi-times-circle' },
    { status: EnrollmentStatus.EXPIRED, count: 0, label: 'Expired', color: '#6c757d', icon: 'pi-ban' }
  ];

  // Filters
  statusFilter: EnrollmentStatus | null = null;
  typeFilter: EnrollmentType | null = null;

  // UI state
  isLoading = false;
  showDetailsDialog = false;

  // Enums
  enrollmentStatuses = Object.values(EnrollmentStatus);
  enrollmentTypes = Object.values(EnrollmentType);

  constructor(
    private enrollmentsService: EnrollmentsService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMyEnrollments();
  }

  loadMyEnrollments(): void {
    this.isLoading = true;
    this.enrollmentsService.getMyEnrollments().subscribe({
      next: (enrollments) => {
        this.allEnrollments = enrollments;
        this.updateStatusCounts();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading enrollments:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load enrollments'
        });
        this.isLoading = false;
      }
    });
  }

  updateStatusCounts(): void {
    this.statusCounts.forEach(sc => sc.count = 0);
    this.allEnrollments.forEach(enrollment => {
      const statusCount = this.statusCounts.find(sc => sc.status === enrollment.status);
      if (statusCount) {
        statusCount.count++;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allEnrollments];

    if (this.statusFilter) {
      filtered = filtered.filter(e => e.status === this.statusFilter);
    }

    if (this.typeFilter) {
      filtered = filtered.filter(e => e.enrollmentType === this.typeFilter);
    }

    this.enrollments = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.typeFilter = null;
    this.applyFilters();
  }

  filterByStatus(status: EnrollmentStatus): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  viewDetails(enrollment: EmployeeBenefitEnrollment): void {
    this.selectedEnrollment = enrollment;
    this.showDetailsDialog = true;
  }

  closeDetailsDialog(): void {
    this.showDetailsDialog = false;
    this.selectedEnrollment = null;
  }

  cancelEnrollment(enrollment: EmployeeBenefitEnrollment): void {
    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot Cancel',
        detail: 'Only active enrollments can be cancelled'
      });
      return;
    }

    const reason = prompt('Please enter cancellation reason:');
    if (!reason) return;

    this.enrollmentsService.cancelEnrollment(enrollment.id, reason).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Enrollment cancelled successfully'
        });
        this.loadMyEnrollments();
        this.closeDetailsDialog();
      },
      error: (error) => {
        console.error('Error cancelling enrollment:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to cancel enrollment'
        });
      }
    });
  }

  submitClaim(enrollment: EmployeeBenefitEnrollment): void {
    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot Submit Claim',
        detail: 'Claims can only be submitted for active enrollments'
      });
      return;
    }
    // Navigate to claim submission with enrollment pre-selected
    this.router.navigate(['/hr/submit-claim'], {
      queryParams: { enrollmentId: enrollment.id }
    });
  }

  enrollInBenefits(): void {
    this.router.navigate(['/hr/enroll-benefits']);
  }

  getStatusBadgeClass(status: EnrollmentStatus): string {
    const badges: Record<EnrollmentStatus, string> = {
      [EnrollmentStatus.PENDING]: 'badge-warning',
      [EnrollmentStatus.ACTIVE]: 'badge-success',
      [EnrollmentStatus.CANCELLED]: 'badge-danger',
      [EnrollmentStatus.EXPIRED]: 'badge-secondary'
    };
    return badges[status] || 'badge-secondary';
  }

  getTypeBadgeClass(type: EnrollmentType): string {
    const badges: Record<EnrollmentType, string> = {
      [EnrollmentType.AUTO]: 'badge-primary',
      [EnrollmentType.VOLUNTARY]: 'badge-info',
      [EnrollmentType.MANDATORY]: 'badge-secondary'
    };
    return badges[type] || 'badge-light';
  }

  formatCurrency(amount: number | null): string {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString()}`;
  }

  formatDate(date: string | Date | null): string {
    if (!date) return '-';
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  }

  hasDependents(enrollment: EmployeeBenefitEnrollment): boolean {
    return enrollment.dependents && enrollment.dependents.length > 0;
  }

  getDependentCount(enrollment: EmployeeBenefitEnrollment): number {
    if (!enrollment.dependents) return 0;
    try {
      const deps = typeof enrollment.dependents === 'string'
        ? JSON.parse(enrollment.dependents)
        : enrollment.dependents;
      return Array.isArray(deps) ? deps.length : 0;
    } catch {
      return 0;
    }
  }

  parseDependents(dependents: any): any[] {
    if (!dependents) return [];
    try {
      return typeof dependents === 'string' ? JSON.parse(dependents) : dependents;
    } catch {
      return [];
    }
  }

  getTotalMonthlyContribution(enrollment: EmployeeBenefitEnrollment): number {
    return enrollment.customEmployeeContribution || enrollment.benefitPolicy?.employeeContributionAmount || 0;
  }

  getTotalCoverage(enrollment: EmployeeBenefitEnrollment): number {
    return enrollment.customCoverageAmount || enrollment.benefitPolicy?.coverageAmount || 0;
  }
}
