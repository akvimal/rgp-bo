import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { BenefitClaim, ClaimStatus } from '../models/hr.models';

interface TimelineEvent {
  status: string;
  date: string | Date | null;
  user?: string;
  remarks?: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-claim-details-dialog',
  templateUrl: './claim-details-dialog.component.html',
  styleUrls: ['./claim-details-dialog.component.scss']
})
export class ClaimDetailsDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() claim: BenefitClaim | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();

  timeline: TimelineEvent[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['claim'] && this.claim) {
      this.buildTimeline();
    }
  }

  buildTimeline(): void {
    if (!this.claim) return;

    this.timeline = [];

    // Submitted
    this.timeline.push({
      status: 'Submitted',
      date: this.claim.claimDate,
      remarks: this.claim.description,
      icon: 'pi-file',
      color: '#007bff'
    });

    // Under Review
    if (this.claim.reviewedBy) {
      this.timeline.push({
        status: 'Under Review',
        date: this.claim.reviewedOn || null,
        user: `Reviewer #${this.claim.reviewedBy}`,
        remarks: this.claim.reviewerRemarks || undefined,
        icon: 'pi-eye',
        color: '#ffc107'
      });
    }

    // Approved
    if (this.claim.status === ClaimStatus.APPROVED || this.claim.status === ClaimStatus.PAID) {
      this.timeline.push({
        status: 'Approved',
        date: this.claim.approvedOn || null,
        user: this.claim.approvedBy ? `Approver #${this.claim.approvedBy}` : undefined,
        remarks: `Approved amount: ₹${this.claim.approvedAmount?.toLocaleString()}`,
        icon: 'pi-check-circle',
        color: '#28a745'
      });
    }

    // Rejected
    if (this.claim.status === ClaimStatus.REJECTED) {
      this.timeline.push({
        status: 'Rejected',
        date: null,
        remarks: this.claim.rejectionReason || undefined,
        icon: 'pi-times-circle',
        color: '#dc3545'
      });
    }

    // Paid
    if (this.claim.status === ClaimStatus.PAID) {
      this.timeline.push({
        status: 'Paid',
        date: this.claim.paymentDate || null,
        remarks: this.claim.paymentReference
          ? `Payment ref: ${this.claim.paymentReference} | Mode: ${this.claim.paymentMode}`
          : undefined,
        icon: 'pi-money-bill',
        color: '#6f42c1'
      });
    }
  }

  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.close.emit();
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

  getClaimTypeBadgeClass(type: string): string {
    const badges: Record<string, string> = {
      'REIMBURSEMENT': 'badge-info',
      'DIRECT_BILLING': 'badge-primary',
      'CASHLESS': 'badge-success'
    };
    return badges[type] || 'badge-light';
  }

  formatCurrency(amount: number | null): string {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString()}`;
  }

  formatDate(date: string | Date | null): string {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  }

  parseDocuments(documents: any): any[] {
    if (!documents) return [];
    try {
      return typeof documents === 'string' ? JSON.parse(documents) : documents;
    } catch {
      return [];
    }
  }

  getDocumentIcon(doc: any): string {
    const fileName = doc.fileName || doc.name || '';
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return 'pi-image';
    } else if (fileName.match(/\.pdf$/i)) {
      return 'pi-file-pdf';
    }
    return 'pi-file';
  }
}
