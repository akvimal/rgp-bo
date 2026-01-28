import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { BenefitsService } from '../services/benefits.service';
import { BenefitPolicy, BenefitMaster } from '../models/hr.models';

@Component({
  selector: 'app-benefit-policy-form',
  templateUrl: './benefit-policy-form.component.html',
  styleUrls: ['./benefit-policy-form.component.scss']
})
export class BenefitPolicyFormComponent implements OnInit, OnChanges {
  @Input() visible = false;
  @Input() policy: BenefitPolicy | null = null;
  @Input() isEditMode = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() policySaved = new EventEmitter<BenefitPolicy>();

  policyForm!: FormGroup;
  benefitMasters: BenefitMaster[] = [];
  isLoading = false;
  isSaving = false;

  // Coverage type selection
  coverageType: 'amount' | 'percentage' | 'formula' = 'amount';

  // Documents array
  documentsRequired: string[] = [];
  newDocument = '';

  constructor(
    private fb: FormBuilder,
    private benefitsService: BenefitsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadBenefitMasters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['policy'] && this.policy && this.policyForm) {
      this.populateForm();
    }
    if (changes['visible'] && this.visible && !this.policy) {
      this.resetForm();
    }
  }

  initializeForm(): void {
    this.policyForm = this.fb.group({
      // Basic Information
      benefitId: [null, Validators.required],
      policyName: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],

      // Coverage Configuration
      coverageAmount: [null],
      coveragePercentage: [null],
      coverageFormula: [null],

      // Cost Sharing
      employeeContributionAmount: [0, [Validators.required, Validators.min(0)]],
      employeeContributionPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      employerContributionAmount: [0, [Validators.required, Validators.min(0)]],
      employerContributionPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],

      // Family Coverage
      familyCoverageAllowed: [false],
      maxDependents: [0, [Validators.min(0)]],
      dependentCoverageAmount: [null],

      // Policy Details
      policyProvider: [''],
      policyNumber: [''],
      policyStartDate: [null],
      policyEndDate: [null],
      renewalDate: [null],

      // Rules & Limits
      waitingPeriodDays: [0, [Validators.required, Validators.min(0)]],
      claimSubmissionDeadlineDays: [30, [Validators.required, Validators.min(1)]],
      maxClaimsPerYear: [null],
      termsAndConditions: [''],

      // Effective Dates
      effectiveFrom: [new Date(), Validators.required],
      effectiveTo: [null],
      active: [true]
    });

    // Watch coverage type changes
    this.setupCoverageTypeWatchers();
  }

  setupCoverageTypeWatchers(): void {
    this.policyForm.get('coverageAmount')?.valueChanges.subscribe(value => {
      if (value && value > 0) {
        this.coverageType = 'amount';
        this.policyForm.patchValue({
          coveragePercentage: null,
          coverageFormula: null
        }, { emitEvent: false });
      }
    });

    this.policyForm.get('coveragePercentage')?.valueChanges.subscribe(value => {
      if (value && value > 0) {
        this.coverageType = 'percentage';
        this.policyForm.patchValue({
          coverageAmount: null,
          coverageFormula: null
        }, { emitEvent: false });
      }
    });
  }

  loadBenefitMasters(): void {
    this.isLoading = true;
    this.benefitsService.getAllBenefitMasters({ active: true }).subscribe({
      next: (masters) => {
        this.benefitMasters = masters;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading benefit masters:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load benefit types'
        });
        this.isLoading = false;
      }
    });
  }

  populateForm(): void {
    if (!this.policy) return;

    // Determine coverage type
    if (this.policy.coverageAmount) {
      this.coverageType = 'amount';
    } else if (this.policy.coveragePercentage) {
      this.coverageType = 'percentage';
    } else if (this.policy.coverageFormula) {
      this.coverageType = 'formula';
    }

    // Populate documents array
    this.documentsRequired = this.policy.documentsRequired ? [...this.policy.documentsRequired] : [];

    // Populate form
    this.policyForm.patchValue({
      benefitId: this.policy.benefitId,
      policyName: this.policy.policyName,
      description: this.policy.description,
      coverageAmount: this.policy.coverageAmount,
      coveragePercentage: this.policy.coveragePercentage,
      coverageFormula: this.policy.coverageFormula ? JSON.stringify(this.policy.coverageFormula) : null,
      employeeContributionAmount: this.policy.employeeContributionAmount,
      employeeContributionPercentage: this.policy.employeeContributionPercentage,
      employerContributionAmount: this.policy.employerContributionAmount,
      employerContributionPercentage: this.policy.employerContributionPercentage,
      familyCoverageAllowed: this.policy.familyCoverageAllowed,
      maxDependents: this.policy.maxDependents,
      dependentCoverageAmount: this.policy.dependentCoverageAmount,
      policyProvider: this.policy.policyProvider,
      policyNumber: this.policy.policyNumber,
      policyStartDate: this.policy.policyStartDate ? new Date(this.policy.policyStartDate) : null,
      policyEndDate: this.policy.policyEndDate ? new Date(this.policy.policyEndDate) : null,
      renewalDate: this.policy.renewalDate ? new Date(this.policy.renewalDate) : null,
      waitingPeriodDays: this.policy.waitingPeriodDays,
      claimSubmissionDeadlineDays: this.policy.claimSubmissionDeadlineDays,
      maxClaimsPerYear: this.policy.maxClaimsPerYear,
      termsAndConditions: this.policy.termsAndConditions,
      effectiveFrom: this.policy.effectiveFrom ? new Date(this.policy.effectiveFrom) : new Date(),
      effectiveTo: this.policy.effectiveTo ? new Date(this.policy.effectiveTo) : null,
      active: this.policy.active
    });
  }

  resetForm(): void {
    this.policyForm.reset({
      employeeContributionAmount: 0,
      employeeContributionPercentage: 0,
      employerContributionAmount: 0,
      employerContributionPercentage: 0,
      familyCoverageAllowed: false,
      maxDependents: 0,
      waitingPeriodDays: 0,
      claimSubmissionDeadlineDays: 30,
      effectiveFrom: new Date(),
      active: true
    });
    this.coverageType = 'amount';
    this.documentsRequired = [];
    this.newDocument = '';
  }

  setCoverageType(type: 'amount' | 'percentage' | 'formula'): void {
    this.coverageType = type;

    // Clear other coverage fields
    if (type === 'amount') {
      this.policyForm.patchValue({
        coveragePercentage: null,
        coverageFormula: null
      });
    } else if (type === 'percentage') {
      this.policyForm.patchValue({
        coverageAmount: null,
        coverageFormula: null
      });
    } else if (type === 'formula') {
      this.policyForm.patchValue({
        coverageAmount: null,
        coveragePercentage: null
      });
    }
  }

  addDocument(): void {
    if (this.newDocument.trim()) {
      this.documentsRequired.push(this.newDocument.trim());
      this.newDocument = '';
    }
  }

  removeDocument(index: number): void {
    this.documentsRequired.splice(index, 1);
  }

  getBenefitMasterName(benefitId: number): string {
    const master = this.benefitMasters.find(m => m.id === benefitId);
    return master ? master.benefitName : '';
  }

  onSubmit(): void {
    if (this.policyForm.invalid) {
      Object.keys(this.policyForm.controls).forEach(key => {
        const control = this.policyForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all required fields correctly'
      });
      return;
    }

    // Validate coverage configuration
    const formValue = this.policyForm.value;
    if (!formValue.coverageAmount && !formValue.coveragePercentage && !formValue.coverageFormula) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please specify at least one coverage type (Amount, Percentage, or Formula)'
      });
      return;
    }

    // Prepare DTO
    const policyDto: any = {
      ...formValue,
      documentsRequired: this.documentsRequired.length > 0 ? this.documentsRequired : null,
      coverageFormula: formValue.coverageFormula ? JSON.parse(formValue.coverageFormula) : null
    };

    this.isSaving = true;

    if (this.isEditMode && this.policy) {
      // Update existing policy
      this.benefitsService.updateBenefitPolicy(this.policy.id, policyDto).subscribe({
        next: (updated) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Benefit policy updated successfully'
          });
          this.policySaved.emit(updated);
          this.closeDialog();
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error updating benefit policy:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Failed to update benefit policy'
          });
          this.isSaving = false;
        }
      });
    } else {
      // Create new policy
      this.benefitsService.createBenefitPolicy(policyDto).subscribe({
        next: (created) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Benefit policy created successfully'
          });
          this.policySaved.emit(created);
          this.closeDialog();
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error creating benefit policy:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Failed to create benefit policy'
          });
          this.isSaving = false;
        }
      });
    }
  }

  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.resetForm();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.policyForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.policyForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'This field is required';
    }
    if (field?.hasError('min')) {
      return `Minimum value is ${field.errors?.['min'].min}`;
    }
    if (field?.hasError('max')) {
      return `Maximum value is ${field.errors?.['max'].max}`;
    }
    if (field?.hasError('maxlength')) {
      return `Maximum length is ${field.errors?.['maxlength'].requiredLength} characters`;
    }
    return '';
  }
}
