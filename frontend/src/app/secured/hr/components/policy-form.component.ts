import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { PoliciesService } from '../services/policies.service';
import { HrPolicyMaster, PolicyCategory, CreateHrPolicyDto, UpdateHrPolicyDto } from '../models/hr.models';

@Component({
  selector: 'app-policy-form',
  templateUrl: './policy-form.component.html',
  styleUrls: ['./policy-form.component.scss']
})
export class PolicyFormComponent implements OnInit {
  @Input() policy: HrPolicyMaster | null = null;
  @Output() close = new EventEmitter<boolean>();

  policyForm!: FormGroup;
  isLoading = false;
  isEditMode = false;
  visible = true;

  // Enums for dropdowns
  policyCategories = Object.values(PolicyCategory);

  // Policy content as JSON string for editing
  policyContentJson = '';

  constructor(
    private fb: FormBuilder,
    private policiesService: PoliciesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.policy;
    this.initializeForm();
  }

  initializeForm(): void {
    // Initialize form with default values or policy values
    this.policyForm = this.fb.group({
      policyCode: [
        { value: this.policy?.policyCode || '', disabled: this.isEditMode },
        [Validators.required, Validators.maxLength(50)]
      ],
      policyName: [
        this.policy?.policyName || '',
        [Validators.required, Validators.maxLength(200)]
      ],
      policyCategory: [
        this.policy?.policyCategory || null,
        Validators.required
      ],
      description: [
        this.policy?.description || ''
      ],
      policyContent: [
        '',
        Validators.required
      ],
      isMandatory: [
        this.policy?.isMandatory ?? false
      ],
      requiresAcknowledgment: [
        this.policy?.requiresAcknowledgment ?? false
      ],
      effectiveFrom: [
        this.policy?.effectiveFrom ? new Date(this.policy.effectiveFrom) : new Date(),
        Validators.required
      ],
      effectiveTo: [
        this.policy?.effectiveTo ? new Date(this.policy.effectiveTo) : null
      ],
      active: [
        this.policy?.active ?? true
      ]
    });

    // Initialize policy content JSON
    if (this.policy?.policyContent) {
      this.policyContentJson = JSON.stringify(this.policy.policyContent, null, 2);
      this.policyForm.patchValue({ policyContent: this.policyContentJson });
    }
  }

  onPolicyContentChange(): void {
    // Update form value when JSON textarea changes
    const contentControl = this.policyForm.get('policyContent');
    if (contentControl) {
      this.policyContentJson = contentControl.value;
    }
  }

  validateJson(): boolean {
    try {
      if (this.policyContentJson.trim()) {
        JSON.parse(this.policyContentJson);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  onSubmit(): void {
    if (this.policyForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all required fields correctly'
      });
      Object.keys(this.policyForm.controls).forEach(key => {
        const control = this.policyForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    // Validate JSON content
    if (!this.validateJson()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid JSON',
        detail: 'Policy content must be valid JSON'
      });
      return;
    }

    this.isLoading = true;

    // Parse policy content from JSON string
    let policyContent: Record<string, any> = {};
    try {
      policyContent = JSON.parse(this.policyContentJson);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'JSON Parse Error',
        detail: 'Failed to parse policy content JSON'
      });
      this.isLoading = false;
      return;
    }

    // Get form values
    const formValue = this.policyForm.getRawValue(); // getRawValue includes disabled fields

    if (this.isEditMode && this.policy) {
      // Update existing policy
      const updateDto: UpdateHrPolicyDto = {
        policyName: formValue.policyName,
        policyCategory: formValue.policyCategory,
        description: formValue.description || undefined,
        policyContent: policyContent,
        isMandatory: formValue.isMandatory,
        requiresAcknowledgment: formValue.requiresAcknowledgment,
        effectiveFrom: this.formatDate(formValue.effectiveFrom),
        effectiveTo: formValue.effectiveTo ? this.formatDate(formValue.effectiveTo) : undefined,
        active: formValue.active
      };

      this.policiesService.updatePolicy(this.policy.id, updateDto).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Policy updated successfully'
          });
          this.isLoading = false;
          this.closeDialog(true);
        },
        error: (error) => {
          console.error('Error updating policy:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Failed to update policy'
          });
          this.isLoading = false;
        }
      });
    } else {
      // Create new policy
      const createDto: CreateHrPolicyDto = {
        policyCode: formValue.policyCode,
        policyName: formValue.policyName,
        policyCategory: formValue.policyCategory,
        description: formValue.description || undefined,
        policyContent: policyContent,
        isMandatory: formValue.isMandatory,
        requiresAcknowledgment: formValue.requiresAcknowledgment,
        effectiveFrom: this.formatDate(formValue.effectiveFrom),
        effectiveTo: formValue.effectiveTo ? this.formatDate(formValue.effectiveTo) : undefined
      };

      this.policiesService.createPolicy(createDto).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Policy created successfully'
          });
          this.isLoading = false;
          this.closeDialog(true);
        },
        error: (error) => {
          console.error('Error creating policy:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Failed to create policy'
          });
          this.isLoading = false;
        }
      });
    }
  }

  onCancel(): void {
    this.closeDialog(false);
  }

  closeDialog(saved: boolean): void {
    this.visible = false;
    setTimeout(() => {
      this.close.emit(saved);
    }, 100);
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper method to check if field has error
  hasError(fieldName: string): boolean {
    const field = this.policyForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // Helper method to get error message
  getErrorMessage(fieldName: string): string {
    const field = this.policyForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'This field is required';
      if (field.errors['maxlength']) return `Maximum ${field.errors['maxlength'].requiredLength} characters`;
    }
    return '';
  }

  // Sample policy content templates
  loadSampleContent(type: string): void {
    let sample: any = {};

    switch (type) {
      case 'attendance':
        sample = {
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          workingHours: '9:00 AM - 6:00 PM',
          lateArrivalGracePeriod: '15 minutes',
          penalties: {
            lateArrival: 'Warning after 3 occurrences',
            absence: 'Deduction from salary'
          }
        };
        break;
      case 'leave':
        sample = {
          annualLeave: 20,
          sickLeave: 12,
          casualLeave: 10,
          noticeRequired: '2 days in advance',
          maxConsecutiveDays: 15
        };
        break;
      case 'conduct':
        sample = {
          dresscode: 'Business casual',
          behaviorExpectations: [
            'Professional communication',
            'Respect for colleagues',
            'Punctuality'
          ],
          prohibitedActivities: [
            'Harassment',
            'Discrimination',
            'Substance abuse'
          ]
        };
        break;
      default:
        sample = {
          title: 'Policy Title',
          description: 'Policy description',
          rules: ['Rule 1', 'Rule 2', 'Rule 3']
        };
    }

    this.policyContentJson = JSON.stringify(sample, null, 2);
    this.policyForm.patchValue({ policyContent: this.policyContentJson });
  }
}
