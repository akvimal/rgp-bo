import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { PoliciesService } from '../services/policies.service';
import { HrPolicyMaster, PolicyCategory } from '../models/hr.models';

@Component({
  selector: 'app-employee-policies',
  templateUrl: './employee-policies.component.html',
  styleUrls: ['./employee-policies.component.scss']
})
export class EmployeePoliciesComponent implements OnInit {
  // Policies data
  policies: HrPolicyMaster[] = [];
  allPolicies: HrPolicyMaster[] = [];
  selectedPolicy: HrPolicyMaster | null = null;

  // Filters
  categoryFilter: PolicyCategory | null = null;
  searchText = '';
  showAcknowledgedOnly = false;
  showMandatoryOnly = false;

  // UI state
  isLoading = false;
  showPolicyDialog = false;

  // Enums
  policyCategories = Object.values(PolicyCategory);

  constructor(
    private policiesService: PoliciesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadMyPolicies();
  }

  loadMyPolicies(): void {
    this.isLoading = true;
    this.policiesService.getMyPolicies().subscribe({
      next: (policies) => {
        this.allPolicies = policies;
        this.applyFilters();
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

  applyFilters(): void {
    let filtered = [...this.allPolicies];

    // Category filter
    if (this.categoryFilter) {
      filtered = filtered.filter(p => p.policyCategory === this.categoryFilter);
    }

    // Search filter
    if (this.searchText.trim()) {
      const search = this.searchText.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.policyName.toLowerCase().includes(search) ||
        p.policyCode.toLowerCase().includes(search)
      );
    }

    // Acknowledged filter
    if (this.showAcknowledgedOnly) {
      filtered = filtered.filter(p => p.acknowledgedOn != null);
    }

    // Mandatory filter
    if (this.showMandatoryOnly) {
      filtered = filtered.filter(p => p.isMandatory);
    }

    this.policies = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.categoryFilter = null;
    this.searchText = '';
    this.showAcknowledgedOnly = false;
    this.showMandatoryOnly = false;
    this.applyFilters();
  }

  viewPolicyDetails(policy: HrPolicyMaster): void {
    this.selectedPolicy = policy;
    this.showPolicyDialog = true;
  }

  closePolicyDialog(): void {
    this.showPolicyDialog = false;
    this.selectedPolicy = null;
  }

  acknowledgePolicy(policy: HrPolicyMaster): void {
    if (policy.acknowledgedOn) {
      this.messageService.add({
        severity: 'info',
        summary: 'Already Acknowledged',
        detail: 'You have already acknowledged this policy'
      });
      return;
    }

    if (!confirm(`Do you acknowledge that you have read and understood "${policy.policyName}"?`)) {
      return;
    }

    this.policiesService.acknowledgePolicy(policy.id).subscribe({
      next: (acknowledgment) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Policy acknowledged successfully'
        });
        // Update the policy's acknowledged date in the list
        const index = this.allPolicies.findIndex(p => p.id === policy.id);
        if (index !== -1) {
          this.allPolicies[index].acknowledgedOn = acknowledgment.acknowledgedOn;
        }
        if (this.selectedPolicy?.id === policy.id) {
          this.selectedPolicy.acknowledgedOn = acknowledgment.acknowledgedOn;
        }
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error acknowledging policy:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to acknowledge policy'
        });
      }
    });
  }

  getCategoryBadgeClass(category: PolicyCategory): string {
    const badges: Record<PolicyCategory, string> = {
      [PolicyCategory.EMPLOYMENT]: 'badge-info',
      [PolicyCategory.COMPENSATION]: 'badge-secondary',
      [PolicyCategory.ATTENDANCE]: 'badge-info',
      [PolicyCategory.CONDUCT]: 'badge-warning',
      [PolicyCategory.BENEFITS]: 'badge-success',
      [PolicyCategory.LEAVE]: 'badge-primary',
      [PolicyCategory.PERFORMANCE]: 'badge-danger',
      [PolicyCategory.SAFETY]: 'badge-warning',
      [PolicyCategory.OTHER]: 'badge-light'
    };
    return badges[category] || 'badge-secondary';
  }

  isAcknowledgementRequired(policy: HrPolicyMaster): boolean {
    return policy.requiresAcknowledgment && !policy.acknowledgedOn;
  }

  getPendingAcknowledgmentCount(): number {
    return this.allPolicies.filter(p => this.isAcknowledgementRequired(p)).length;
  }

  getMandatoryPoliciesCount(): number {
    return this.allPolicies.filter(p => p.isMandatory).length;
  }

  getAcknowledgedPoliciesCount(): number {
    return this.allPolicies.filter(p => p.acknowledgedOn != null).length;
  }

  formatDate(date: string | Date | null): string {
    if (!date) return '-';
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  }

  parsePolicyContent(content: any): any {
    if (typeof content === 'string') {
      try {
        return JSON.parse(content);
      } catch {
        return { text: content };
      }
    }
    return content || {};
  }
}
