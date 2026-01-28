import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { EnrollmentsService } from '../services/enrollments.service';
import { BenefitsService } from '../services/benefits.service';
import { EmployeeBenefitEnrollment, EnrollmentStatus, BenefitPolicy } from '../models/hr.models';

interface StatusCount {
  status: EnrollmentStatus;
  count: number;
  label: string;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-enrollment-management',
  templateUrl: './enrollment-management.component.html',
  styleUrls: ['./enrollment-management.component.scss']
})
export class EnrollmentManagementComponent implements OnInit {
  // Enrollments data
  enrollments: EmployeeBenefitEnrollment[] = [];
  allEnrollments: EmployeeBenefitEnrollment[] = [];
  selectedEnrollment: EmployeeBenefitEnrollment | null = null;
  selectedEnrollments: EmployeeBenefitEnrollment[] = [];

  // Benefit policies for filtering
  benefitPolicies: BenefitPolicy[] = [];

  // Dashboard status counts
  statusCounts: StatusCount[] = [
    { status: EnrollmentStatus.PENDING, count: 0, label: 'Pending', color: '#ffc107', icon: 'pi-clock' },
    { status: EnrollmentStatus.ACTIVE, count: 0, label: 'Active', color: '#28a745', icon: 'pi-check-circle' },
    { status: EnrollmentStatus.CANCELLED, count: 0, label: 'Cancelled', color: '#dc3545', icon: 'pi-times-circle' },
    { status: EnrollmentStatus.EXPIRED, count: 0, label: 'Expired', color: '#6c757d', icon: 'pi-ban' }
  ];

  // Filters
  statusFilter: EnrollmentStatus | null = null;
  benefitPolicyFilter: number | null = null;
  userIdFilter: number | null = null;

  // UI State
  isLoading = false;
  showDetailsDialog = false;
  showBulkEnrollDialog = false;

  // Enums for dropdowns
  enrollmentStatuses = Object.values(EnrollmentStatus);

  // View mode: 'all' or 'pending'
  viewMode: 'all' | 'pending' = 'all';

  constructor(
    private enrollmentsService: EnrollmentsService,
    private benefitsService: BenefitsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadBenefitPolicies();
    this.loadAllEnrollments();
  }

  loadBenefitPolicies(): void {
    this.benefitsService.getAllBenefitPolicies({ active: true }).subscribe({
      next: (policies) => {
        this.benefitPolicies = policies;
      },
      error: (error) => {
        console.error('Error loading benefit policies:', error);
      }
    });
  }

  loadAllEnrollments(): void {
    this.isLoading = true;
    this.enrollmentsService.getAllEnrollments({}).subscribe({
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
    // Reset counts
    this.statusCounts.forEach(sc => sc.count = 0);

    // Count enrollments by status
    this.allEnrollments.forEach(enrollment => {
      const statusCount = this.statusCounts.find(sc => sc.status === enrollment.status);
      if (statusCount) {
        statusCount.count++;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allEnrollments];

    // View mode filter
    if (this.viewMode === 'pending') {
      filtered = filtered.filter(e => e.status === EnrollmentStatus.PENDING);
    }

    // Status filter
    if (this.statusFilter) {
      filtered = filtered.filter(e => e.status === this.statusFilter);
    }

    // Benefit policy filter
    if (this.benefitPolicyFilter) {
      filtered = filtered.filter(e => e.benefitPolicyId === this.benefitPolicyFilter);
    }

    // User ID filter
    if (this.userIdFilter) {
      filtered = filtered.filter(e => e.userId === this.userIdFilter);
    }

    this.enrollments = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.benefitPolicyFilter = null;
    this.userIdFilter = null;
    this.applyFilters();
  }

  filterByStatus(status: EnrollmentStatus): void {
    this.statusFilter = status;
    this.viewMode = 'all';
    this.applyFilters();
  }

  switchToApprovalQueue(): void {
    this.viewMode = 'pending';
    this.statusFilter = null;
    this.applyFilters();
  }

  switchToAllEnrollments(): void {
    this.viewMode = 'all';
    this.applyFilters();
  }

  viewEnrollmentDetails(enrollment: EmployeeBenefitEnrollment): void {
    this.selectedEnrollment = enrollment;
    this.showDetailsDialog = true;
  }

  onDetailsDialogClose(): void {
    this.showDetailsDialog = false;
    this.selectedEnrollment = null;
  }

  approveEnrollment(enrollment: EmployeeBenefitEnrollment): void {
    if (!confirm(`Approve enrollment for User #${enrollment.userId}?`)) {
      return;
    }

    const approveDto = {
      approved: true,
      remarks: 'Approved by admin'
    };

    this.enrollmentsService.approveEnrollment(enrollment.id, approveDto).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Enrollment approved successfully'
        });
        this.loadAllEnrollments();
      },
      error: (error) => {
        console.error('Error approving enrollment:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to approve enrollment'
        });
      }
    });
  }

  rejectEnrollment(enrollment: EmployeeBenefitEnrollment): void {
    const reason = prompt(`Enter rejection reason for User #${enrollment.userId}:`);
    if (!reason) return;

    const approveDto = {
      approvalRemarks: reason
    };

    // Using approve endpoint with negative remarks as rejection
    // In a real app, you'd want a separate reject endpoint
    this.messageService.add({
      severity: 'warn',
      summary: 'Info',
      detail: 'Rejection functionality to be implemented'
    });
  }

  cancelEnrollment(enrollment: EmployeeBenefitEnrollment): void {
    const reason = prompt(`Enter cancellation reason for User #${enrollment.userId}:`);
    if (!reason) return;

    this.enrollmentsService.cancelEnrollment(enrollment.id, reason).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Enrollment cancelled successfully'
        });
        this.loadAllEnrollments();
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

  bulkApprove(): void {
    if (this.selectedEnrollments.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select enrollments to approve'
      });
      return;
    }

    if (!confirm(`Approve ${this.selectedEnrollments.length} enrollment(s)?`)) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    this.selectedEnrollments.forEach((enrollment, index) => {
      const approveDto = { approved: true, remarks: 'Bulk approved by admin' };

      this.enrollmentsService.approveEnrollment(enrollment.id, approveDto).subscribe({
        next: () => {
          successCount++;
          if (index === this.selectedEnrollments.length - 1) {
            this.onBulkOperationComplete(successCount, errorCount);
          }
        },
        error: () => {
          errorCount++;
          if (index === this.selectedEnrollments.length - 1) {
            this.onBulkOperationComplete(successCount, errorCount);
          }
        }
      });
    });
  }

  onBulkOperationComplete(successCount: number, errorCount: number): void {
    this.messageService.add({
      severity: errorCount > 0 ? 'warn' : 'success',
      summary: 'Bulk Operation Complete',
      detail: `${successCount} approved, ${errorCount} failed`
    });
    this.selectedEnrollments = [];
    this.loadAllEnrollments();
  }

  openBulkEnrollDialog(): void {
    this.showBulkEnrollDialog = true;
  }

  onBulkEnrollDialogClose(saved: boolean): void {
    this.showBulkEnrollDialog = false;
    if (saved) {
      this.loadAllEnrollments();
    }
  }

  getStatusBadgeClass(status: EnrollmentStatus): string {
    const badges: Record<EnrollmentStatus, string> = {
      [EnrollmentStatus.PENDING]: 'badge-warning',
      [EnrollmentStatus.ACTIVE]: 'badge-success',
      [EnrollmentStatus.CANCELLED]: 'badge-danger',
      [EnrollmentStatus.EXPIRED]: 'badge-secondary'
    };
    return badges[status] || 'badge-light';
  }

  formatCurrency(amount: number | null): string {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString()}`;
  }

  formatDate(date: Date | string | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN');
  }

  getBenefitPolicyName(policyId: number): string {
    const policy = this.benefitPolicies.find(p => p.id === policyId);
    return policy ? policy.policyName : `Policy #${policyId}`;
  }

  isPendingEnrollment(enrollment: EmployeeBenefitEnrollment): boolean {
    return enrollment.status === EnrollmentStatus.PENDING;
  }

  isActiveEnrollment(enrollment: EmployeeBenefitEnrollment): boolean {
    return enrollment.status === EnrollmentStatus.ACTIVE;
  }

  hasDependents(enrollment: EmployeeBenefitEnrollment): boolean {
    return !!enrollment.dependents && Object.keys(enrollment.dependents).length > 0;
  }

  getPendingCount(): number {
    return this.statusCounts.find(sc => sc.status === EnrollmentStatus.PENDING)?.count || 0;
  }
}
