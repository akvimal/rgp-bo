import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
  selector: 'app-my-claims',
  templateUrl: './my-claims.component.html',
  styleUrls: ['./my-claims.component.scss']
})
export class MyClaimsComponent implements OnInit {
  // Claims data
  claims: BenefitClaim[] = [];
  allClaims: BenefitClaim[] = [];
  selectedClaim: BenefitClaim | null = null;

  // Status counts
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
  dateFromFilter: Date | null = null;
  dateToFilter: Date | null = null;
  claimNumberSearch = '';

  // UI state
  isLoading = false;
  showDetailsDialog = false;

  // Enums
  claimStatuses = Object.values(ClaimStatus);
  claimTypes = Object.values(ClaimType);

  constructor(
    private claimsService: ClaimsService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMyClaims();
  }

  loadMyClaims(): void {
    this.isLoading = true;
    this.claimsService.getMyClaims().subscribe({
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
    this.statusCounts.forEach(sc => sc.count = 0);
    this.allClaims.forEach(claim => {
      const statusCount = this.statusCounts.find(sc => sc.status === claim.status);
      if (statusCount) {
        statusCount.count++;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allClaims];

    if (this.statusFilter) {
      filtered = filtered.filter(c => c.status === this.statusFilter);
    }

    if (this.claimTypeFilter) {
      filtered = filtered.filter(c => c.claimType === this.claimTypeFilter);
    }

    if (this.dateFromFilter) {
      filtered = filtered.filter(c => new Date(c.claimDate) >= this.dateFromFilter!);
    }

    if (this.dateToFilter) {
      filtered = filtered.filter(c => new Date(c.claimDate) <= this.dateToFilter!);
    }

    if (this.claimNumberSearch.trim()) {
      const search = this.claimNumberSearch.trim().toUpperCase();
      filtered = filtered.filter(c => c.claimNumber.toUpperCase().includes(search));
    }

    this.claims = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.claimTypeFilter = null;
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
    this.showDetailsDialog = true;
  }

  closeDetailsDialog(): void {
    this.showDetailsDialog = false;
    this.selectedClaim = null;
  }

  submitNewClaim(): void {
    this.router.navigate(['/hr/submit-claim']);
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

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  getWorkflowStage(claim: BenefitClaim): number {
    const stages: Record<ClaimStatus, number> = {
      [ClaimStatus.SUBMITTED]: 0,
      [ClaimStatus.UNDER_REVIEW]: 1,
      [ClaimStatus.APPROVED]: 2,
      [ClaimStatus.REJECTED]: 2,
      [ClaimStatus.PAID]: 3
    };
    return stages[claim.status] || 0;
  }

  getTotalClaimedAmount(): number {
    return this.claims.reduce((sum, claim) => sum + (claim.claimedAmount || 0), 0);
  }

  getTotalApprovedAmount(): number {
    return this.claims
      .filter(c => c.status === ClaimStatus.APPROVED || c.status === ClaimStatus.PAID)
      .reduce((sum, claim) => sum + (claim.approvedAmount || 0), 0);
  }

  getTotalPaidAmount(): number {
    return this.claims
      .filter(c => c.status === ClaimStatus.PAID)
      .reduce((sum, claim) => sum + (claim.approvedAmount || 0), 0);
  }
}
