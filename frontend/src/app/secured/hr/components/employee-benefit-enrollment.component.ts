import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EnrollmentsService } from '../services/enrollments.service';
import { BenefitsService } from '../services/benefits.service';
import { BenefitPolicy, EnrollmentType } from '../models/hr.models';

@Component({
  selector: 'app-employee-benefit-enrollment',
  templateUrl: './employee-benefit-enrollment.component.html',
  styleUrls: ['./employee-benefit-enrollment.component.scss']
})
export class EmployeeBenefitEnrollmentComponent implements OnInit {
  // Available benefits
  availableBenefits: BenefitPolicy[] = [];
  selectedBenefit: BenefitPolicy | null = null;

  // Enrollment form
  enrollmentForm!: FormGroup;
  isSubmitting = false;
  showEnrollmentForm = false;

  // Enums
  enrollmentTypes = Object.values(EnrollmentType);

  // Date constraints
  maxDate = new Date();

  constructor(
    private fb: FormBuilder,
    private enrollmentsService: EnrollmentsService,
    private benefitsService: BenefitsService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadAvailableBenefits();
  }

  initializeForm(): void {
    this.enrollmentForm = this.fb.group({
      benefitPolicyId: [null, Validators.required],
      enrollmentType: [EnrollmentType.VOLUNTARY, Validators.required],
      dependents: this.fb.array([]),
      nomineeName: ['', [Validators.required, Validators.maxLength(200)]],
      nomineeRelationship: ['', [Validators.required, Validators.maxLength(100)]],
      nomineeDob: [null, Validators.required],
      nomineeContact: ['', [Validators.maxLength(50)]],
      nomineePercentage: [100, [Validators.required, Validators.min(1), Validators.max(100)]]
    });

    // Watch enrollment type changes
    this.enrollmentForm.get('enrollmentType')?.valueChanges.subscribe(type => {
      this.onEnrollmentTypeChange(type);
    });
  }

  get dependentsFormArray(): FormArray {
    return this.enrollmentForm.get('dependents') as FormArray;
  }

  loadAvailableBenefits(): void {
    this.enrollmentsService.getAvailableBenefits().subscribe({
      next: (benefits) => {
        this.availableBenefits = benefits;
      },
      error: (error) => {
        console.error('Error loading available benefits:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load available benefits'
        });
      }
    });
  }

  viewBenefitDetails(benefit: BenefitPolicy): void {
    this.selectedBenefit = benefit;
  }

  enrollInBenefit(benefit: BenefitPolicy): void {
    this.selectedBenefit = benefit;
    this.enrollmentForm.patchValue({
      benefitPolicyId: benefit.id
    });
    this.showEnrollmentForm = true;
  }

  closeEnrollmentForm(): void {
    this.showEnrollmentForm = false;
    this.enrollmentForm.reset({
      enrollmentType: EnrollmentType.VOLUNTARY,
      nomineePercentage: 100
    });
    this.dependentsFormArray.clear();
    this.selectedBenefit = null;
  }

  onEnrollmentTypeChange(type: EnrollmentType): void {
    // Clear dependents when changing type
    this.dependentsFormArray.clear();

    // Note: EnrollmentType values are AUTO, VOLUNTARY, MANDATORY
    // Dependents management is handled separately through familyCoverageAllowed flag
  }

  addDependent(): void {
    const dependentForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      relationship: ['', [Validators.required, Validators.maxLength(100)]],
      dob: [null, Validators.required],
      contact: ['', [Validators.maxLength(50)]]
    });
    this.dependentsFormArray.push(dependentForm);
  }

  removeDependent(index: number): void {
    this.dependentsFormArray.removeAt(index);
  }

  submitEnrollment(): void {
    if (this.enrollmentForm.invalid) {
      Object.keys(this.enrollmentForm.controls).forEach(key => {
        const control = this.enrollmentForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill all required fields'
      });
      return;
    }

    if (!confirm('Are you sure you want to enroll in this benefit?')) {
      return;
    }

    this.isSubmitting = true;

    const formValue = this.enrollmentForm.value;
    const enrollmentDto = {
      benefitPolicyId: formValue.benefitPolicyId,
      enrollmentType: formValue.enrollmentType,
      dependents: formValue.dependents.length > 0 ? formValue.dependents : undefined,
      nomineeName: formValue.nomineeName,
      nomineeRelationship: formValue.nomineeRelationship,
      nomineeDob: formValue.nomineeDob ? new Date(formValue.nomineeDob).toISOString().split('T')[0] : undefined,
      nomineeContact: formValue.nomineeContact || undefined,
      nomineePercentage: formValue.nomineePercentage,
      effectiveFrom: new Date().toISOString().split('T')[0]
    };

    this.enrollmentsService.enrollInBenefit(enrollmentDto).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Enrollment submitted successfully. Pending approval.'
        });
        this.isSubmitting = false;
        this.closeEnrollmentForm();
        // Navigate to my benefits
        this.router.navigate(['/hr/my-benefits']);
      },
      error: (error) => {
        console.error('Error enrolling in benefit:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to submit enrollment'
        });
        this.isSubmitting = false;
      }
    });
  }

  calculateMonthlyCost(benefit: BenefitPolicy): number {
    return benefit.employeeContributionAmount || 0;
  }

  calculateCoverage(benefit: BenefitPolicy): string {
    if (benefit.coverageAmount) {
      return `₹${benefit.coverageAmount.toLocaleString()}`;
    } else if (benefit.coveragePercentage) {
      return `${benefit.coveragePercentage}% of base`;
    } else {
      return 'As per policy';
    }
  }

  formatCurrency(amount: number | null): string {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString()}`;
  }

  hasMaxDependentsReached(benefit: BenefitPolicy): boolean {
    if (!benefit.maxDependents) return false;
    return this.dependentsFormArray.length >= benefit.maxDependents;
  }

  canAddDependent(benefit: BenefitPolicy): boolean {
    // Allow adding dependents if family coverage is allowed
    if (!benefit.familyCoverageAllowed) {
      return false;
    }
    return !this.hasMaxDependentsReached(benefit);
  }

  getBenefitCategoryClass(category: string): string {
    const classes: Record<string, string> = {
      'HEALTH': 'badge-success',
      'INSURANCE': 'badge-primary',
      'RETIREMENT': 'badge-info',
      'WELLNESS': 'badge-warning',
      'OTHER': 'badge-secondary'
    };
    return classes[category] || 'badge-secondary';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.enrollmentForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  isDependentFieldInvalid(index: number, fieldName: string): boolean {
    const field = this.dependentsFormArray.at(index).get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
