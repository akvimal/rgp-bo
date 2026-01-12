import { Component, Input } from '@angular/core';

/**
 * Reusable component for displaying invoice status badges
 * Supports payment status, tax status, and lifecycle status
 */
@Component({
    selector: 'app-invoice-status-badges',
    templateUrl: './invoice-status-badges.component.html'
})
export class InvoiceStatusBadgesComponent {

    @Input() paymentStatus?: string;
    @Input() taxStatus?: string;
    @Input() lifecycleStatus?: string;
    @Input() docType?: string;

    /**
     * Get Bootstrap badge class for payment status
     */
    getPaymentStatusClass(): string {
        switch (this.paymentStatus) {
            case 'PAID':
                return 'badge bg-success';
            case 'PARTIAL':
                return 'badge bg-warning text-dark';
            case 'UNPAID':
                return 'badge bg-danger';
            default:
                return 'badge bg-secondary';
        }
    }

    /**
     * Get user-friendly payment status label
     */
    getPaymentStatusLabel(): string {
        switch (this.paymentStatus) {
            case 'PAID':
                return 'Paid';
            case 'PARTIAL':
                return 'Partial';
            case 'UNPAID':
                return 'Unpaid';
            default:
                return 'Unknown';
        }
    }

    /**
     * Get Bootstrap badge class for tax status
     */
    getTaxStatusClass(): string {
        switch (this.taxStatus) {
            case 'RECONCILED':
                return 'badge bg-success';
            case 'CREDITED':
                return 'badge bg-info';
            case 'FILED':
                return 'badge bg-primary';
            case 'PENDING':
                return 'badge bg-warning text-dark';
            case 'MISMATCH':
                return 'badge bg-danger';
            default:
                return 'badge bg-secondary';
        }
    }

    /**
     * Get user-friendly tax status label
     */
    getTaxStatusLabel(): string {
        switch (this.taxStatus) {
            case 'RECONCILED':
                return 'Tax Reconciled';
            case 'CREDITED':
                return 'Tax Credited';
            case 'FILED':
                return 'Tax Filed';
            case 'PENDING':
                return 'Tax Pending';
            case 'MISMATCH':
                return 'Tax Mismatch';
            default:
                return 'Tax Unknown';
        }
    }

    /**
     * Get Bootstrap badge class for lifecycle status
     */
    getLifecycleStatusClass(): string {
        switch (this.lifecycleStatus) {
            case 'CLOSED':
                return 'badge bg-dark';
            case 'OPEN':
                return 'badge bg-primary';
            default:
                return 'badge bg-secondary';
        }
    }

    /**
     * Get user-friendly lifecycle status label
     */
    getLifecycleStatusLabel(): string {
        switch (this.lifecycleStatus) {
            case 'CLOSED':
                return 'Closed';
            case 'OPEN':
                return 'Open';
            default:
                return 'Unknown';
        }
    }

    /**
     * Get Bootstrap badge class for document type
     */
    getDocTypeClass(): string {
        switch (this.docType) {
            case 'INVOICE':
                return 'badge bg-primary';
            case 'DELIVERY_CHALLAN':
                return 'badge bg-info';
            default:
                return 'badge bg-secondary';
        }
    }

    /**
     * Get user-friendly document type label
     */
    getDocTypeLabel(): string {
        switch (this.docType) {
            case 'INVOICE':
                return 'Invoice';
            case 'DELIVERY_CHALLAN':
                return 'Delivery Challan';
            default:
                return 'Unknown';
        }
    }
}
