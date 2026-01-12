import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { InvoiceLifecycleSummary } from "../invoice.model";
import { InvoiceService } from "../invoices.service";

/**
 * Phase 3 Invoice Lifecycle Summary Component
 * Shows overall status and allows invoice closure
 */
@Component({
    selector: 'app-invoice-lifecycle-summary',
    templateUrl: "./invoice-lifecycle-summary.component.html"
})
export class InvoiceLifecycleSummaryComponent implements OnInit {

    @Input() invoiceId: any;
    @Output() lifecycleUpdated = new EventEmitter();

    // Lifecycle data
    lifecycleSummary: InvoiceLifecycleSummary | null = null;
    loading: boolean = false;
    errorMessage: string = '';

    // Closure
    showClosureForm: boolean = false;
    closureNotes: string = '';
    closingInvoice: boolean = false;

    constructor(private invoiceService: InvoiceService) {}

    ngOnInit() {
        this.loadLifecycleSummary();
    }

    /**
     * Load lifecycle summary
     */
    loadLifecycleSummary() {
        this.loading = true;
        this.invoiceService.getLifecycleSummary(this.invoiceId).subscribe({
            next: (summary) => {
                this.lifecycleSummary = summary;
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to load lifecycle summary: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Refresh lifecycle summary
     */
    refresh() {
        this.loadLifecycleSummary();
    }

    /**
     * Show closure form
     */
    showClosureDialog() {
        this.showClosureForm = true;
        this.closureNotes = '';
    }

    /**
     * Cancel closure
     */
    cancelClosure() {
        this.showClosureForm = false;
        this.closureNotes = '';
    }

    /**
     * Close invoice
     */
    closeInvoice() {
        if (!this.closureNotes.trim()) {
            alert('Please provide closure notes');
            return;
        }

        this.closingInvoice = true;
        this.errorMessage = '';

        this.invoiceService.closeInvoice(this.invoiceId, this.closureNotes).subscribe({
            next: () => {
                this.loadLifecycleSummary();
                this.showClosureForm = false;
                this.closureNotes = '';
                this.closingInvoice = false;
                this.lifecycleUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to close invoice: ' + error.message;
                this.closingInvoice = false;
            }
        });
    }

    /**
     * Reopen invoice
     */
    reopenInvoice() {
        if (!confirm('Are you sure you want to reopen this closed invoice?')) {
            return;
        }

        this.loading = true;
        this.invoiceService.reopenInvoice(this.invoiceId).subscribe({
            next: () => {
                this.loadLifecycleSummary();
                this.loading = false;
                this.lifecycleUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to reopen invoice: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Get status badge class
     */
    getStatusBadgeClass(status: string): string {
        switch (status) {
            case 'PAID': return 'badge bg-success';
            case 'PARTIAL': return 'badge bg-warning text-dark';
            case 'UNPAID': return 'badge bg-danger';
            case 'CLOSED': return 'badge bg-dark';
            case 'OPEN': return 'badge bg-primary';
            case 'COMPLETE': return 'badge bg-success';
            case 'CLAIMED': return 'badge bg-success';
            case 'RECONCILED': return 'badge bg-success';
            case 'PENDING': return 'badge bg-warning text-dark';
            default: return 'badge bg-secondary';
        }
    }

    /**
     * Get progress percentage
     */
    getProgressPercentage(current: number, total: number): number {
        if (total === 0) return 0;
        return Math.round((current / total) * 100);
    }

    /**
     * Format amount for display
     */
    formatAmount(amount: number): string {
        if (!amount) return '0.00';
        return amount.toFixed(2);
    }
}
