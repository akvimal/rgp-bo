import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ClaimsService } from '../services/claims.service';
import { BenefitClaim, ClaimStatus, ClaimType } from '../models/hr.models';

interface StatusCount {
  status: ClaimStatus;
  count: number;
  label: string;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-claims-management',
  templateUrl: './claims-management.component.html',
  styleUrls: ['./claims-management.component.scss']
})
export class ClaimsManagementComponent implements OnInit {
  // Claims data
  claims: BenefitClaim[] = [];
  allClaims: BenefitClaim[] = [];
  selectedClaim: BenefitClaim | null = null;

  // Dashboard status counts
  statusCounts: StatusCount[] = [
    { status: ClaimStatus.SUBMITTED, count: 0, label: 'Submitted', color: '#17a2b8', icon: 'pi-file' },
    { status: ClaimStatus.UNDER_REVIEW, count: 0, label: 'Under Review', color: '#ffc107', icon: 'pi-eye' },
    { status: ClaimStatus.APPROVED, count: 0, label: 'Approved', color: '#28a745', icon: 'pi-check-circle' },
    { status: ClaimStatus.REJECTED, count: 0, label: 'Rejected', color: '#dc3545', icon: 'pi-times-circle' },
    { status: ClaimStatus.PAID, count: 0, label: 'Paid', color: '#6f42c1', icon: 'pi-money-bill' }
  ];

  // Filters
  statusFilter: ClaimStatus | null = null;
  claimTypeFilter: ClaimType | null = null;
  userIdFilter: number | null = null;
  dateFromFilter: Date | null = null;
  dateToFilter: Date | null = null;
  claimNumberSearch = '';

  // UI State
  isLoading = false;
  showReviewDialog = false;

  // Enums for dropdowns
  claimStatuses = Object.values(ClaimStatus);
  claimTypes = Object.values(ClaimType);

  constructor(
    private claimsService: ClaimsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadAllClaims();
  }

  loadAllClaims(): void {
    this.isLoading = true;
    this.claimsService.getAllClaims({}).subscribe({
      next: (claims) => {
        this.allClaims = claims;
        this.updateStatusCounts();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading claims:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load claims'
        });
        this.isLoading = false;
      }
    });
  }

  updateStatusCounts(): void {
    // Reset counts
    this.statusCounts.forEach(sc => sc.count = 0);

    // Count claims by status
    this.allClaims.forEach(claim => {
      const statusCount = this.statusCounts.find(sc => sc.status === claim.status);
      if (statusCount) {
        statusCount.count++;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allClaims];

    // Status filter
    if (this.statusFilter) {
      filtered = filtered.filter(c => c.status === this.statusFilter);
    }

    // Claim type filter
    if (this.claimTypeFilter) {
      filtered = filtered.filter(c => c.claimType === this.claimTypeFilter);
    }

    // User ID filter
    if (this.userIdFilter) {
      filtered = filtered.filter(c => c.userId === this.userIdFilter);
    }

    // Date from filter
    if (this.dateFromFilter) {
      filtered = filtered.filter(c => new Date(c.claimDate) >= this.dateFromFilter!);
    }

    // Date to filter
    if (this.dateToFilter) {
      filtered = filtered.filter(c => new Date(c.claimDate) <= this.dateToFilter!);
    }

    // Claim number search
    if (this.claimNumberSearch.trim()) {
      const searchTerm = this.claimNumberSearch.trim().toUpperCase();
      filtered = filtered.filter(c => c.claimNumber.toUpperCase().includes(searchTerm));
    }

    this.claims = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.claimTypeFilter = null;
    this.userIdFilter = null;
    this.dateFromFilter = null;
    this.dateToFilter = null;
    this.claimNumberSearch = '';
    this.applyFilters();
  }

  filterByStatus(status: ClaimStatus): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  viewClaimDetails(claim: BenefitClaim): void {
    this.selectedClaim = claim;
    this.showReviewDialog = true;
  }

  onReviewDialogClose(updated: boolean): void {
    this.showReviewDialog = false;
    this.selectedClaim = null;
    if (updated) {
      this.loadAllClaims();
    }
  }

  onClaimUpdated(updatedClaim: BenefitClaim): void {
    // Reload all claims to get fresh data
    this.loadAllClaims();
    this.showReviewDialog = false;
    this.selectedClaim = null;
  }

  getStatusBadgeClass(status: ClaimStatus): string {
    const badges: Record<ClaimStatus, string> = {
      [ClaimStatus.SUBMITTED]: 'badge-info',
      [ClaimStatus.UNDER_REVIEW]: 'badge-warning',
      [ClaimStatus.APPROVED]: 'badge-success',
      [ClaimStatus.REJECTED]: 'badge-danger',
      [ClaimStatus.PAID]: 'badge-primary'
    };
    return badges[status] || 'badge-secondary';
  }

  getClaimTypeBadgeClass(type: ClaimType): string {
    const badges: Record<ClaimType, string> = {
      [ClaimType.REIMBURSEMENT]: 'badge-info',
      [ClaimType.DIRECT_BILLING]: 'badge-primary',
      [ClaimType.CASHLESS]: 'badge-success'
    };
    return badges[type] || 'badge-light';
  }

  formatCurrency(amount: number | null): string {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString()}`;
  }

  getWorkflowStage(claim: BenefitClaim): number {
    // Returns 0-4 for workflow progress visualization
    const stages: Record<ClaimStatus, number> = {
      [ClaimStatus.SUBMITTED]: 0,
      [ClaimStatus.UNDER_REVIEW]: 1,
      [ClaimStatus.APPROVED]: 2,
      [ClaimStatus.REJECTED]: 2,
      [ClaimStatus.PAID]: 3
    };
    return stages[claim.status] || 0;
  }

  isClaimEditable(claim: BenefitClaim): boolean {
    return claim.status === ClaimStatus.SUBMITTED || claim.status === ClaimStatus.UNDER_REVIEW;
  }

  canApproveClaim(claim: BenefitClaim): boolean {
    return claim.status === ClaimStatus.UNDER_REVIEW;
  }

  canPayClaim(claim: BenefitClaim): boolean {
    return claim.status === ClaimStatus.APPROVED;
  }

  quickReview(claim: BenefitClaim): void {
    this.viewClaimDetails(claim);
  }

  quickApprove(claim: BenefitClaim): void {
    if (!confirm(`Approve claim ${claim.claimNumber} for ${this.formatCurrency(claim.claimedAmount)}?`)) {
      return;
    }

    const approveDto = {
      approvedAmount: claim.claimedAmount,
      reviewRemarks: 'Quick approval'
    };

    this.claimsService.approveClaim(claim.id, approveDto).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Claim approved successfully'
        });
        this.loadAllClaims();
      },
      error: (error) => {
        console.error('Error approving claim:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to approve claim'
        });
      }
    });
  }

  quickReject(claim: BenefitClaim): void {
    const reason = prompt(`Enter rejection reason for claim ${claim.claimNumber}:`);
    if (!reason) return;

    const rejectDto = {
      rejectionReason: reason
    };

    this.claimsService.rejectClaim(claim.id, rejectDto).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Claim rejected'
        });
        this.loadAllClaims();
      },
      error: (error) => {
        console.error('Error rejecting claim:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to reject claim'
        });
      }
    });
  }

  markAsPaid(claim: BenefitClaim): void {
    const paymentRef = prompt(`Enter payment reference for claim ${claim.claimNumber}:`);
    if (!paymentRef) return;

    const payDto = {
      paymentMode: 'BANK_TRANSFER' as any,
      paymentReference: paymentRef,
      paymentDate: new Date().toISOString().split('T')[0]
    };

    this.claimsService.markClaimAsPaid(claim.id, payDto).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Claim marked as paid'
        });
        this.loadAllClaims();
      },
      error: (error) => {
        console.error('Error marking claim as paid:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to mark claim as paid'
        });
      }
    });
  }

  getTotalClaimedAmount(): number {
    return this.claims.reduce((sum, claim) => sum + (claim.claimedAmount || 0), 0);
  }

  getTotalApprovedAmount(): number {
    return this.claims
      .filter(c => c.status === ClaimStatus.APPROVED || c.status === ClaimStatus.PAID)
      .reduce((sum, claim) => sum + (claim.approvedAmount || 0), 0);
  }
}
