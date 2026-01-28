import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ClaimsService } from '../services/claims.service';
import { EnrollmentsService } from '../services/enrollments.service';
import { EmployeeBenefitEnrollment, ClaimType, EnrollmentStatus } from '../models/hr.models';

@Component({
  selector: 'app-employee-claim-submission',
  templateUrl: './employee-claim-submission.component.html',
  styleUrls: ['./employee-claim-submission.component.scss']
})
export class EmployeeClaimSubmissionComponent implements OnInit {
  // Form
  claimForm!: FormGroup;
  isSubmitting = false;

  // Enrollments
  activeEnrollments: EmployeeBenefitEnrollment[] = [];
  selectedEnrollment: EmployeeBenefitEnrollment | null = null;

  // Documents
  uploadedDocuments: File[] = [];

  // Enums
  claimTypes = Object.values(ClaimType);

  // Today's date for max date validation
  today = new Date();

  constructor(
    private fb: FormBuilder,
    private claimsService: ClaimsService,
    private enrollmentsService: EnrollmentsService,
    private messageService: MessageService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadActiveEnrollments();

    // Check if enrollmentId is passed via query params
    this.route.queryParams.subscribe(params => {
      if (params['enrollmentId']) {
        const enrollmentId = parseInt(params['enrollmentId'], 10);
        this.claimForm.patchValue({ enrollmentId });
      }
    });
  }

  initializeForm(): void {
    this.claimForm = this.fb.group({
      enrollmentId: [null, Validators.required],
      claimType: [ClaimType.REIMBURSEMENT, Validators.required],
      claimDate: [new Date(), Validators.required],
      claimedAmount: [null, [Validators.required, Validators.min(1)]],
      description: ['', [Validators.required, Validators.maxLength(1000)]]
    });

    // Watch enrollment selection
    this.claimForm.get('enrollmentId')?.valueChanges.subscribe(enrollmentId => {
      this.onEnrollmentChange(enrollmentId);
    });
  }

  loadActiveEnrollments(): void {
    this.enrollmentsService.getMyEnrollments().subscribe({
      next: (enrollments) => {
        this.activeEnrollments = enrollments.filter(
          e => e.status === EnrollmentStatus.ACTIVE
        );

        if (this.activeEnrollments.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'No Active Enrollments',
            detail: 'You need an active benefit enrollment to submit claims'
          });
        }
      },
      error: (error) => {
        console.error('Error loading enrollments:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load enrollments'
        });
      }
    });
  }

  onEnrollmentChange(enrollmentId: number): void {
    this.selectedEnrollment = this.activeEnrollments.find(e => e.id === enrollmentId) || null;
  }

  onFileSelect(event: any): void {
    const files: FileList = event.target.files;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.messageService.add({
          severity: 'warn',
          summary: 'File Too Large',
          detail: `${file.name} exceeds 5MB limit`
        });
        continue;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid File Type',
          detail: `${file.name} is not a valid file type (JPG, PNG, PDF only)`
        });
        continue;
      }

      this.uploadedDocuments.push(file);
    }

    // Clear input
    event.target.value = '';
  }

  removeDocument(index: number): void {
    this.uploadedDocuments.splice(index, 1);
  }

  getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) {
      return 'pi-image';
    } else if (file.type === 'application/pdf') {
      return 'pi-file-pdf';
    }
    return 'pi-file';
  }

  getFileSizeDisplay(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  submitClaim(): void {
    if (this.claimForm.invalid) {
      Object.keys(this.claimForm.controls).forEach(key => {
        const control = this.claimForm.get(key);
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

    if (this.uploadedDocuments.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Documents Required',
        detail: 'Please upload at least one supporting document'
      });
      return;
    }

    if (!confirm('Are you sure you want to submit this claim?')) {
      return;
    }

    this.isSubmitting = true;

    const formValue = this.claimForm.value;
    const claimDto = {
      enrollmentId: formValue.enrollmentId,
      benefitPolicyId: this.selectedEnrollment?.benefitPolicyId || formValue.enrollmentId,
      claimType: formValue.claimType,
      claimedAmount: formValue.claimedAmount,
      description: formValue.description
    };

    this.claimsService.submitClaim(claimDto).subscribe({
      next: (claim) => {
        // Upload documents
        if (this.uploadedDocuments.length > 0) {
          this.uploadDocuments(claim.id);
        } else {
          this.onSubmitSuccess();
        }
      },
      error: (error) => {
        console.error('Error submitting claim:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to submit claim'
        });
        this.isSubmitting = false;
      }
    });
  }

  uploadDocuments(claimId: number): void {
    const formData = new FormData();
    this.uploadedDocuments.forEach(file => {
      formData.append('documents', file);
    });

    this.claimsService.uploadClaimDocuments(claimId, formData).subscribe({
      next: () => {
        this.onSubmitSuccess();
      },
      error: (error) => {
        console.error('Error uploading documents:', error);
        this.messageService.add({
          severity: 'warn',
          summary: 'Partial Success',
          detail: 'Claim submitted but some documents failed to upload'
        });
        this.isSubmitting = false;
        this.navigateToMyClaims();
      }
    });
  }

  onSubmitSuccess(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Claim submitted successfully'
    });
    this.isSubmitting = false;
    this.navigateToMyClaims();
  }

  navigateToMyClaims(): void {
    setTimeout(() => {
      this.router.navigate(['/hr/my-claims']);
    }, 1500);
  }

  resetForm(): void {
    this.claimForm.reset({
      claimType: ClaimType.REIMBURSEMENT,
      claimDate: new Date()
    });
    this.uploadedDocuments = [];
    this.selectedEnrollment = null;
  }

  formatDate(date: Date): string {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  }

  formatCurrency(amount: number | null): string {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString()}`;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.claimForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
