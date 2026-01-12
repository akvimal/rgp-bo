import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { VendorPayment } from "../invoice.model";
import { InvoiceService } from "../invoices.service";

/**
 * Phase 3 Payment Manager Component
 * Manages multiple payments for an invoice with full lifecycle support
 */
@Component({
    selector: 'app-invoice-payment',
    templateUrl: "./invoice-payment.component.html"
})
export class InvoicePaymentComponent implements OnInit {

    @Input() invoiceId: any;
    @Input() vendorId: any;
    @Input() invoiceTotal: number = 0;
    @Input() docType?: string = 'INVOICE';
    @Output() paymentUpdated = new EventEmitter();

    // Payment data
    payments: VendorPayment[] = [];
    paymentSummary: any = null;

    // UI state
    showAddPaymentForm: boolean = false;
    editingPayment: VendorPayment | null = null;
    loading: boolean = false;
    errorMessage: string = '';

    // Payment form
    paymentForm: FormGroup = new FormGroup({
        amount: new FormControl('', [Validators.required, Validators.min(0.01)]),
        paymentdate: new FormControl('', Validators.required),
        paymentmode: new FormControl('', Validators.required),
        paymenttype: new FormControl('FULL', Validators.required),

        // Optional fields
        bankname: new FormControl(''),
        chequeno: new FormControl(''),
        utrno: new FormControl(''),
        notes: new FormControl('')
    });

    // Payment mode options
    paymentModes: string[] = [
        'Cash',
        'Cheque',
        'Bank Transfer',
        'UPI',
        'Credit Card',
        'Debit Card'
    ];

    // Payment type options
    paymentTypes: string[] = ['ADVANCE', 'PARTIAL', 'FULL'];

    constructor(private invoiceService: InvoiceService) {}

    ngOnInit() {
        this.loadPayments();
        this.loadPaymentSummary();
    }

    /**
     * Load all payments for this invoice
     */
    loadPayments() {
        this.loading = true;
        this.invoiceService.getPayments(this.invoiceId).subscribe({
            next: (payments) => {
                this.payments = payments;
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to load payments: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Load payment summary
     */
    loadPaymentSummary() {
        this.invoiceService.getPaymentSummary(this.invoiceId).subscribe({
            next: (summary) => {
                this.paymentSummary = summary;
            },
            error: (error) => {
                console.error('Failed to load payment summary:', error);
            }
        });
    }

    /**
     * Show add payment form
     */
    showAddForm() {
        this.showAddPaymentForm = true;
        this.editingPayment = null;
        this.paymentForm.reset({
            paymenttype: 'FULL',
            paymentdate: new Date().toISOString().split('T')[0]
        });

        // Pre-fill with outstanding amount
        if (this.paymentSummary) {
            const outstanding = this.paymentSummary.outstandingamount || this.invoiceTotal;
            this.paymentForm.patchValue({ amount: outstanding });
        }
    }

    /**
     * Edit an existing payment
     */
    editPayment(payment: VendorPayment) {
        this.editingPayment = payment;
        this.showAddPaymentForm = true;

        this.paymentForm.patchValue({
            amount: payment.amount,
            paymentdate: payment.paymentdate,
            paymentmode: payment.paymentmode,
            paymenttype: payment.paymenttype,
            bankname: payment.bankname || '',
            chequeno: payment.chequeno || '',
            utrno: payment.utrno || '',
            notes: payment.notes || ''
        });
    }

    /**
     * Cancel add/edit form
     */
    cancelForm() {
        this.showAddPaymentForm = false;
        this.editingPayment = null;
        this.paymentForm.reset();
    }

    /**
     * Submit payment (add or update)
     */
    submitPayment() {
        if (!this.paymentForm.valid) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        const paymentData: VendorPayment = {
            invoiceid: this.invoiceId,
            vendorid: this.vendorId,
            amount: this.paymentForm.value.amount,
            paymentdate: this.paymentForm.value.paymentdate,
            paymentmode: this.paymentForm.value.paymentmode,
            paymenttype: this.paymentForm.value.paymenttype,
            paymentstatus: 'COMPLETED',
            paymentagainst: this.docType as 'INVOICE' | 'DELIVERY_CHALLAN',
            bankname: this.paymentForm.value.bankname || undefined,
            chequeno: this.paymentForm.value.chequeno || undefined,
            utrno: this.paymentForm.value.utrno || undefined,
            notes: this.paymentForm.value.notes || undefined
        };

        if (this.editingPayment) {
            // Update existing payment
            this.invoiceService.updatePayment(this.editingPayment.id!, paymentData).subscribe({
                next: () => {
                    this.loadPayments();
                    this.loadPaymentSummary();
                    this.cancelForm();
                    this.loading = false;
                    this.paymentUpdated.emit(this.invoiceId);
                },
                error: (error) => {
                    this.errorMessage = 'Failed to update payment: ' + error.message;
                    this.loading = false;
                }
            });
        } else {
            // Create new payment
            this.invoiceService.createPayment(this.invoiceId, paymentData).subscribe({
                next: () => {
                    this.loadPayments();
                    this.loadPaymentSummary();
                    this.cancelForm();
                    this.loading = false;
                    this.paymentUpdated.emit(this.invoiceId);
                },
                error: (error) => {
                    this.errorMessage = 'Failed to create payment: ' + error.message;
                    this.loading = false;
                }
            });
        }
    }

    /**
     * Delete a payment
     */
    deletePayment(paymentId: number) {
        if (!confirm('Are you sure you want to delete this payment?')) {
            return;
        }

        this.loading = true;
        this.invoiceService.deletePayment(paymentId).subscribe({
            next: () => {
                this.loadPayments();
                this.loadPaymentSummary();
                this.loading = false;
                this.paymentUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to delete payment: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Reconcile a payment
     */
    reconcilePayment(paymentId: number) {
        this.loading = true;
        this.invoiceService.reconcilePayment(paymentId).subscribe({
            next: () => {
                this.loadPayments();
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to reconcile payment: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Get payment type badge class
     */
    getPaymentTypeBadgeClass(type: string): string {
        switch (type) {
            case 'FULL': return 'badge bg-success';
            case 'PARTIAL': return 'badge bg-warning text-dark';
            case 'ADVANCE': return 'badge bg-info';
            default: return 'badge bg-secondary';
        }
    }

    /**
     * Get payment status badge class
     */
    getPaymentStatusBadgeClass(status: string): string {
        switch (status) {
            case 'COMPLETED': return 'badge bg-success';
            case 'PENDING': return 'badge bg-warning text-dark';
            case 'FAILED': return 'badge bg-danger';
            default: return 'badge bg-secondary';
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString();
    }

    /**
     * Format amount for display
     */
    formatAmount(amount: number): string {
        return amount.toFixed(2);
    }
}
