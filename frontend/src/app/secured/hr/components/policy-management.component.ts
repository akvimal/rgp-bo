import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { PoliciesService } from '../services/policies.service';
import { HrPolicyMaster, PolicyCategory } from '../models/hr.models';

@Component({
  selector: 'app-policy-management',
  templateUrl: './policy-management.component.html',
  styleUrls: ['./policy-management.component.scss']
})
export class PolicyManagementComponent implements OnInit {
  policies: HrPolicyMaster[] = [];
  isLoading = false;
  showPolicyForm = false;
  showVersionHistory = false;
  selectedPolicy: HrPolicyMaster | null = null;
  versionHistory: HrPolicyMaster[] = [];

  // Filters
  selectedCategory: PolicyCategory | null = null;
  activeFilter: boolean | null = null;
  mandatoryFilter: boolean | null = null;

  // Enums for dropdown
  policyCategories = Object.values(PolicyCategory);

  constructor(
    private policiesService: PoliciesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.isLoading = true;
    const filters: any = {};
    if (this.selectedCategory) filters.category = this.selectedCategory;
    if (this.activeFilter !== null) filters.active = this.activeFilter;
    if (this.mandatoryFilter !== null) filters.mandatory = this.mandatoryFilter;

    this.policiesService.getAllPolicies(filters).subscribe({
      next: (policies) => {
        this.policies = policies;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading policies:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load policies'
        });
        this.isLoading = false;
      }
    });
  }

  openNewPolicyForm(): void {
    this.selectedPolicy = null;
    this.showPolicyForm = true;
  }

  editPolicy(policy: HrPolicyMaster): void {
    this.selectedPolicy = policy;
    this.showPolicyForm = true;
  }

  deletePolicy(policy: HrPolicyMaster): void {
    if (confirm(`Are you sure you want to archive policy "${policy.policyName}"?`)) {
      this.policiesService.archivePolicy(policy.id).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Policy archived successfully'
          });
          this.loadPolicies();
        },
        error: (error) => {
          console.error('Error archiving policy:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Failed to archive policy'
          });
        }
      });
    }
  }

  viewVersionHistory(policy: HrPolicyMaster): void {
    this.selectedPolicy = policy;
    this.isLoading = true;
    this.policiesService.getPolicyHistory(policy.policyCode).subscribe({
      next: (history) => {
        this.versionHistory = history;
        this.showVersionHistory = true;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading version history:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load version history'
        });
        this.isLoading = false;
      }
    });
  }

  viewAcknowledgments(policy: HrPolicyMaster): void {
    // Navigate to acknowledgments page or show in dialog
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Acknowledgments feature - to be implemented'
    });
  }

  onPolicyFormClose(saved: boolean): void {
    this.showPolicyForm = false;
    this.selectedPolicy = null;
    if (saved) {
      this.loadPolicies();
    }
  }

  onFilterChange(): void {
    this.loadPolicies();
  }

  clearFilters(): void {
    this.selectedCategory = null;
    this.activeFilter = null;
    this.mandatoryFilter = null;
    this.loadPolicies();
  }

  getCategoryBadgeClass(category: PolicyCategory): string {
    const badgeMap: Record<PolicyCategory, string> = {
      [PolicyCategory.EMPLOYMENT]: 'badge-info',
      [PolicyCategory.COMPENSATION]: 'badge-primary',
      [PolicyCategory.ATTENDANCE]: 'badge-info',
      [PolicyCategory.CONDUCT]: 'badge-warning',
      [PolicyCategory.BENEFITS]: 'badge-secondary',
      [PolicyCategory.LEAVE]: 'badge-success',
      [PolicyCategory.PERFORMANCE]: 'badge-danger',
      [PolicyCategory.SAFETY]: 'badge-warning',
      [PolicyCategory.OTHER]: 'badge-light'
    };
    return badgeMap[category] || 'badge-light';
  }

  formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }
}
