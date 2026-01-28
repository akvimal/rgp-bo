import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { BenefitsService } from '../services/benefits.service';
import { BenefitMaster, BenefitPolicy, BenefitCategory } from '../models/hr.models';

@Component({
  selector: 'app-benefit-management',
  templateUrl: './benefit-management.component.html',
  styleUrls: ['./benefit-management.component.scss']
})
export class BenefitManagementComponent implements OnInit {
  // Active tab index
  activeTabIndex = 0;

  // Benefit Masters
  benefitMasters: BenefitMaster[] = [];
  selectedBenefitMaster: BenefitMaster | null = null;
  masterCategoryFilter: BenefitCategory | null = null;
  masterActiveFilter: boolean | null = null;

  // Benefit Policies
  benefitPolicies: BenefitPolicy[] = [];
  selectedBenefitPolicy: BenefitPolicy | null = null;
  policyBenefitTypeFilter: number | null = null;
  policyActiveFilter: boolean | null = null;

  // UI State
  isLoading = false;
  showMasterForm = false;
  showPolicyForm = false;
  showCoverageCalculator = false;

  // Enums for dropdowns
  benefitCategories = Object.values(BenefitCategory);

  constructor(
    private benefitsService: BenefitsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadBenefitMasters();
    this.loadBenefitPolicies();
  }

  // ==================== Benefit Masters ====================

  loadBenefitMasters(): void {
    this.isLoading = true;
    const filters: any = {};
    if (this.masterCategoryFilter) filters.category = this.masterCategoryFilter;
    if (this.masterActiveFilter !== null) filters.active = this.masterActiveFilter;

    this.benefitsService.getAllBenefitMasters(filters).subscribe({
      next: (masters) => {
        this.benefitMasters = masters;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading benefit masters:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load benefit masters'
        });
        this.isLoading = false;
      }
    });
  }

  onMasterFilterChange(): void {
    this.loadBenefitMasters();
  }

  clearMasterFilters(): void {
    this.masterCategoryFilter = null;
    this.masterActiveFilter = null;
    this.loadBenefitMasters();
  }

  openNewMasterForm(): void {
    this.selectedBenefitMaster = null;
    this.showMasterForm = true;
  }

  editMaster(master: BenefitMaster): void {
    this.selectedBenefitMaster = master;
    this.showMasterForm = true;
  }

  archiveMaster(master: BenefitMaster): void {
    if (!confirm(`Are you sure you want to archive benefit type "${master.benefitName}"?`)) {
      return;
    }

    this.benefitsService.archiveBenefitMaster(master.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Benefit master archived successfully'
        });
        this.loadBenefitMasters();
      },
      error: (error) => {
        console.error('Error archiving benefit master:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to archive benefit master'
        });
      }
    });
  }

  onMasterFormClose(saved: boolean): void {
    this.showMasterForm = false;
    this.selectedBenefitMaster = null;
    if (saved) {
      this.loadBenefitMasters();
    }
  }

  getCategoryBadgeClass(category: BenefitCategory): string {
    const badges: Record<BenefitCategory, string> = {
      [BenefitCategory.INSURANCE]: 'badge-info',
      [BenefitCategory.STATUTORY]: 'badge-primary',
      [BenefitCategory.ALLOWANCE]: 'badge-success',
      [BenefitCategory.WELLNESS]: 'badge-secondary',
      [BenefitCategory.EDUCATION]: 'badge-warning',
      [BenefitCategory.RETIREMENT]: 'badge-primary',
      [BenefitCategory.OTHER]: 'badge-light'
    };
    return badges[category] || 'badge-light';
  }

  // ==================== Benefit Policies ====================

  loadBenefitPolicies(): void {
    this.isLoading = true;
    const filters: any = {};
    if (this.policyBenefitTypeFilter) filters.benefitId = this.policyBenefitTypeFilter;
    if (this.policyActiveFilter !== null) filters.active = this.policyActiveFilter;

    this.benefitsService.getAllBenefitPolicies(filters).subscribe({
      next: (policies) => {
        this.benefitPolicies = policies;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading benefit policies:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load benefit policies'
        });
        this.isLoading = false;
      }
    });
  }

  onPolicyFilterChange(): void {
    this.loadBenefitPolicies();
  }

  clearPolicyFilters(): void {
    this.policyBenefitTypeFilter = null;
    this.policyActiveFilter = null;
    this.loadBenefitPolicies();
  }

  openNewPolicyForm(): void {
    this.selectedBenefitPolicy = null;
    this.showPolicyForm = true;
  }

  editPolicy(policy: BenefitPolicy): void {
    this.selectedBenefitPolicy = policy;
    this.showPolicyForm = true;
  }

  archivePolicy(policy: BenefitPolicy): void {
    if (!confirm(`Are you sure you want to archive benefit policy "${policy.policyName}"?`)) {
      return;
    }

    this.benefitsService.archiveBenefitPolicy(policy.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Benefit policy archived successfully'
        });
        this.loadBenefitPolicies();
      },
      error: (error) => {
        console.error('Error archiving benefit policy:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to archive benefit policy'
        });
      }
    });
  }

  onPolicyFormClose(saved: boolean): void {
    this.showPolicyForm = false;
    this.selectedBenefitPolicy = null;
    if (saved) {
      this.loadBenefitPolicies();
    }
  }

  openCoverageCalculator(policy: BenefitPolicy): void {
    this.selectedBenefitPolicy = policy;
    this.showCoverageCalculator = true;
  }

  onCoverageCalculatorClose(): void {
    this.showCoverageCalculator = false;
    this.selectedBenefitPolicy = null;
  }

  formatCoverage(policy: BenefitPolicy): string {
    if (policy.coverageAmount) {
      return `₹${policy.coverageAmount.toLocaleString()}`;
    } else if (policy.coveragePercentage) {
      return `${policy.coveragePercentage}%`;
    } else if (policy.coverageFormula) {
      return 'Formula-based';
    } else {
      return 'N/A';
    }
  }

  formatCostSharing(policy: BenefitPolicy): string {
    const emp = policy.employeeContributionPercentage || 0;
    const employer = policy.employerContributionPercentage || 0;
    return `Emp: ${emp}% | Employer: ${employer}%`;
  }

  getBenefitMasterName(benefitId: number): string {
    const master = this.benefitMasters.find(m => m.id === benefitId);
    return master ? master.benefitName : 'N/A';
  }
}
