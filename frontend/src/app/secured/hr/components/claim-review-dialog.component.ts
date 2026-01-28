import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ClaimsService } from '../services/claims.service';
import { BenefitClaim, ClaimStatus, PaymentMode, ReviewClaimDto, ApproveClaimDto, RejectClaimDto, PayClaimDto } from '../models/hr.models';

interface TimelineEvent {
  status: string;
  date: Date | null;
  user: string | null;
  remarks: string | null;
  icon: string;
  color: string;
}

interface AmountBreakdown {
  claimed: number;
  approved: number | null;
  rejected: number | null;
  paid: number | null;
  pending: number;
}

@Component({
  selector: 'app-claim-review-dialog',
  templateUrl: './claim-review-dialog.component.html',
  styleUrls: ['./claim-review-dialog.component.scss']
})
export class ClaimReviewDialogComponent implements OnInit, OnChanges {
  @Input() visible = false;
  @Input() claim: BenefitClaim | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() claimUpdated = new EventEmitter<BenefitClaim>();

  // Forms
  reviewForm!: FormGroup;
  approveForm!: FormGroup;
  rejectForm!: FormGroup;
  paymentForm!: FormGroup;

  // UI State
  isProcessing = false;
  activeTabIndex = 0;

  // Enums for templates
  claimStatus = ClaimStatus;
  paymentModes = Object.values(PaymentMode);

  // Timeline and breakdown
  timeline: TimelineEvent[] = [];
  amountBreakdown: AmountBreakdown = {
    claimed: 0,
    approved: null,
    rejected: null,
    paid: null,
    pending: 0
  };

  // Documents (parsed from JSON)
  documents: any[] = [];

  constructor(
    private fb: FormBuilder,
    private claimsService: ClaimsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.initializeForms();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['claim'] && this.claim) {
      this.loadClaimData();
    }
  }

  initializeForms(): void {
    // Review form (for SUBMITTED -> UNDER_REVIEW)
    this.reviewForm = this.fb.group({
      approvedAmount: [null, [Validators.min(0)]],
      rejectedAmount: [null, [Validators.min(0)]],
      reviewerRemarks: ['', Validators.maxLength(500)]
    });

    // Approve form (for UNDER_REVIEW -> APPROVED)
    this.approveForm = this.fb.group({
      approvedAmount: [null, [Validators.required, Validators.min(0)]],
      approvalRemarks: ['', Validators.maxLength(500)]
    });

    // Reject form
    this.rejectForm = this.fb.group({
      rejectionReason: ['', [Validators.required, Validators.maxLength(500)]]
    });

    // Payment form (for APPROVED -> PAID)
    this.paymentForm = this.fb.group({
      paymentMode: [PaymentMode.BANK_TRANSFER, Validators.required],
      paymentReference: [''],
      paymentDate: [new Date(), Validators.required],
      payrollRunId: [null]
    });
  }

  loadClaimData(): void {
    if (!this.claim) return;

    // Calculate amount breakdown
    this.amountBreakdown = {
      claimed: this.claim.claimedAmount,
      approved: this.claim.approvedAmount,
      rejected: this.claim.rejectedAmount,
      paid: this.claim.paidAmount,
      pending: this.calculatePendingAmount()
    };

    // Build timeline
    this.buildTimeline();

    // Parse documents
    this.parseDocuments();

    // Pre-fill forms
    this.prefillForms();
  }

  calculatePendingAmount(): number {
    if (!this.claim) return 0;

    let pending = this.claim.claimedAmount;
    if (this.claim.approvedAmount) pending -= this.claim.approvedAmount;
    if (this.claim.rejectedAmount) pending -= this.claim.rejectedAmount;

    return Math.max(0, pending);
  }

  buildTimeline(): void {
    if (!this.claim) return;

    this.timeline = [];

    // Submitted
    this.timeline.push({
      status: 'Submitted',
      date: this.claim.claimDate,
      user: `User #${this.claim.userId}`,
      remarks: this.claim.description,
      icon: 'pi-file',
      color: '#007bff'
    });

    // Under Review
    if (this.claim.status !== ClaimStatus.SUBMITTED) {
      this.timeline.push({
        status: 'Under Review',
        date: this.claim.reviewedOn,
        user: this.claim.reviewedBy ? `Reviewer #${this.claim.reviewedBy}` : null,
        remarks: this.claim.reviewerRemarks,
        icon: 'pi-eye',
        color: '#ffc107'
      });
    }

    // Approved or Rejected
    if (this.claim.status === ClaimStatus.APPROVED || this.claim.status === ClaimStatus.PAID) {
      this.timeline.push({
        status: 'Approved',
        date: this.claim.approvedOn,
        user: this.claim.approvedBy ? `Approver #${this.claim.approvedBy}` : null,
        remarks: this.claim.approvalRemarks,
        icon: 'pi-check-circle',
        color: '#28a745'
      });
    } else if (this.claim.status === ClaimStatus.REJECTED) {
      this.timeline.push({
        status: 'Rejected',
        date: this.claim.approvedOn || this.claim.reviewedOn,
        user: this.claim.approvedBy ? `Approver #${this.claim.approvedBy}` : this.claim.reviewedBy ? `Reviewer #${this.claim.reviewedBy}` : null,
        remarks: this.claim.rejectionReason,
        icon: 'pi-times-circle',
        color: '#dc3545'
      });
    }

    // Paid
    if (this.claim.status === ClaimStatus.PAID) {
      this.timeline.push({
        status: 'Paid',
        date: this.claim.paymentDate,
        user: null,
        remarks: `${this.claim.paymentMode} - ${this.claim.paymentReference || 'N/A'}`,
        icon: 'pi-money-bill',
        color: '#17a2b8'
      });
    }
  }

  parseDocuments(): void {
    if (!this.claim || !this.claim.documents) {
      this.documents = [];
      return;
    }

    // If documents is an object, convert to array
    if (typeof this.claim.documents === 'object') {
      this.documents = Object.keys(this.claim.documents).map(key => ({
        name: key,
        url: this.claim!.documents![key],
        type: this.getDocumentType(this.claim!.documents![key])
      }));
    }
  }

  getDocumentType(url: string): string {
    if (!url) return 'file';
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'file';
  }

  prefillForms(): void {
    if (!this.claim) return;

    // Review form
    this.reviewForm.patchValue({
      approvedAmount: this.claim.claimedAmount,
      rejectedAmount: 0,
      reviewerRemarks: ''
    });

    // Approve form
    this.approveForm.patchValue({
      approvedAmount: this.claim.claimedAmount,
      approvalRemarks: ''
    });

    // Payment form
    this.paymentForm.patchValue({
      paymentMode: PaymentMode.BANK_TRANSFER,
      paymentReference: '',
      paymentDate: new Date(),
      payrollRunId: null
    });
  }

  // ==================== Actions ====================

  startReview(): void {
    if (!this.claim || this.reviewForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all required fields'
      });
      return;
    }

    const reviewDto: ReviewClaimDto = this.reviewForm.value;

    this.isProcessing = true;
    this.claimsService.reviewClaim(this.claim.id, reviewDto).subscribe({
      next: (updated) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Claim moved to review'
        });
        this.claimUpdated.emit(updated);
        this.closeDialog();
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error reviewing claim:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to review claim'
        });
        this.isProcessing = false;
      }
    });
  }

  approveClaim(): void {
    if (!this.claim || this.approveForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all required fields'
      });
      return;
    }

    const approveDto: ApproveClaimDto = this.approveForm.value;

    this.isProcessing = true;
    this.claimsService.approveClaim(this.claim.id, approveDto).subscribe({
      next: (updated) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Claim approved successfully'
        });
        this.claimUpdated.emit(updated);
        this.closeDialog();
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error approving claim:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to approve claim'
        });
        this.isProcessing = false;
      }
    });
  }

  rejectClaim(): void {
    if (!this.claim || this.rejectForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please provide a rejection reason'
      });
      return;
    }

    const rejectDto: RejectClaimDto = this.rejectForm.value;

    this.isProcessing = true;
    this.claimsService.rejectClaim(this.claim.id, rejectDto).subscribe({
      next: (updated) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Claim rejected'
        });
        this.claimUpdated.emit(updated);
        this.closeDialog();
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error rejecting claim:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to reject claim'
        });
        this.isProcessing = false;
      }
    });
  }

  markAsPaid(): void {
    if (!this.claim || this.paymentForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all required payment details'
      });
      return;
    }

    const payDto: PayClaimDto = {
      ...this.paymentForm.value,
      paymentDate: this.formatDate(this.paymentForm.value.paymentDate)
    };

    this.isProcessing = true;
    this.claimsService.markClaimAsPaid(this.claim.id, payDto).subscribe({
      next: (updated) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Claim marked as paid'
        });
        this.claimUpdated.emit(updated);
        this.closeDialog();
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error marking claim as paid:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to mark claim as paid'
        });
        this.isProcessing = false;
      }
    });
  }

  // ==================== Helpers ====================

  formatCurrency(amount: number | null): string {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString()}`;
  }

  formatDate(date: Date | string | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN');
  }

  getStatusBadgeClass(status: ClaimStatus): string {
    const badges: Record<ClaimStatus, string> = {
      [ClaimStatus.SUBMITTED]: 'badge-secondary',
      [ClaimStatus.UNDER_REVIEW]: 'badge-warning',
      [ClaimStatus.APPROVED]: 'badge-success',
      [ClaimStatus.REJECTED]: 'badge-danger',
      [ClaimStatus.PAID]: 'badge-info'
    };
    return badges[status] || 'badge-light';
  }

  canStartReview(): boolean {
    return this.claim?.status === ClaimStatus.SUBMITTED;
  }

  canApprove(): boolean {
    return this.claim?.status === ClaimStatus.UNDER_REVIEW;
  }

  canReject(): boolean {
    return this.claim?.status === ClaimStatus.SUBMITTED || this.claim?.status === ClaimStatus.UNDER_REVIEW;
  }

  canMarkAsPaid(): boolean {
    return this.claim?.status === ClaimStatus.APPROVED;
  }

  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.activeTabIndex = 0;
  }
}
