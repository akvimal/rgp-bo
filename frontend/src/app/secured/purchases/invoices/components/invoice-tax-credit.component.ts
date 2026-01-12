import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { TaxCredit } from "../invoice.model";
import { InvoiceService } from "../invoices.service";

/**
 * Phase 3 Tax Credit Reconciliation Component
 * Manages GST tax credit tracking and reconciliation for purchase invoices
 */
@Component({
    selector: 'app-invoice-tax-credit',
    templateUrl: "./invoice-tax-credit.component.html"
})
export class InvoiceTaxCreditComponent implements OnInit {

    @Input() invoiceId: any;
    @Input() vendorGstin?: string;
    @Input() invoiceTotal: number = 0;
    @Input() taxAmount: number = 0;
    @Output() taxUpdated = new EventEmitter();

    // Tax credit data
    taxCredits: TaxCredit[] = [];

    // UI state
    showAddTaxForm: boolean = false;
    editingTaxCredit: TaxCredit | null = null;
    loading: boolean = false;
    errorMessage: string = '';

    // Tax credit form
    taxForm: FormGroup = new FormGroup({
        gstfilingmonth: new FormControl('', Validators.required),
        vendorgstin: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)]),
        taxableamount: new FormControl('', [Validators.required, Validators.min(0)]),
        cgstamount: new FormControl(''),
        sgstamount: new FormControl(''),
        igstamount: new FormControl(''),
        totaltaxcredit: new FormControl('', [Validators.required, Validators.min(0)]),
        filingstatus: new FormControl('PENDING', Validators.required),
        notes: new FormControl('')
    });

    // Filing status options
    filingStatuses: string[] = ['PENDING', 'FILED_BY_VENDOR', 'REFLECTED_IN_2A', 'CLAIMED'];

    constructor(private invoiceService: InvoiceService) {}

    ngOnInit() {
        this.loadTaxCredits();
        if (this.vendorGstin) {
            this.taxForm.patchValue({ vendorgstin: this.vendorGstin });
        }
    }

    /**
     * Load all tax credits for this invoice
     */
    loadTaxCredits() {
        this.loading = true;
        this.invoiceService.getTaxCredits(this.invoiceId).subscribe({
            next: (taxCredit) => {
                // Backend returns single object or null, convert to array
                this.taxCredits = taxCredit ? [taxCredit] : [];
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to load tax credits: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Show add tax credit form
     */
    showAddForm() {
        this.showAddTaxForm = true;
        this.editingTaxCredit = null;

        // Set default filing month to current month
        const now = new Date();
        const filingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        this.taxForm.reset({
            gstfilingmonth: filingMonth,
            vendorgstin: this.vendorGstin || '',
            taxableamount: this.invoiceTotal || 0,
            totaltaxcredit: this.taxAmount || 0,
            filingstatus: 'PENDING'
        });
    }

    /**
     * Edit an existing tax credit
     */
    editTaxCredit(taxCredit: TaxCredit) {
        this.editingTaxCredit = taxCredit;
        this.showAddTaxForm = true;

        this.taxForm.patchValue({
            gstfilingmonth: taxCredit.gstfilingmonth,
            vendorgstin: taxCredit.vendorgstin,
            taxableamount: taxCredit.taxableamount,
            cgstamount: taxCredit.cgstamount || '',
            sgstamount: taxCredit.sgstamount || '',
            igstamount: taxCredit.igstamount || '',
            totaltaxcredit: taxCredit.totaltaxcredit,
            filingstatus: taxCredit.filingstatus,
            notes: taxCredit.notes || ''
        });
    }

    /**
     * Cancel add/edit form
     */
    cancelForm() {
        this.showAddTaxForm = false;
        this.editingTaxCredit = null;
        this.taxForm.reset();
    }

    /**
     * Submit tax credit (add or update)
     */
    submitTaxCredit() {
        if (!this.taxForm.valid) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        const taxCreditData: TaxCredit = {
            invoiceid: this.invoiceId,
            gstfilingmonth: this.taxForm.value.gstfilingmonth,
            vendorgstin: this.taxForm.value.vendorgstin,
            taxableamount: this.taxForm.value.taxableamount,
            cgstamount: this.taxForm.value.cgstamount || undefined,
            sgstamount: this.taxForm.value.sgstamount || undefined,
            igstamount: this.taxForm.value.igstamount || undefined,
            totaltaxcredit: this.taxForm.value.totaltaxcredit,
            filingstatus: this.taxForm.value.filingstatus,
            notes: this.taxForm.value.notes || undefined
        };

        if (this.editingTaxCredit) {
            // Update existing tax credit
            this.invoiceService.updateTaxCredit(this.editingTaxCredit.id!, taxCreditData).subscribe({
                next: () => {
                    this.loadTaxCredits();
                    this.cancelForm();
                    this.loading = false;
                    this.taxUpdated.emit(this.invoiceId);
                },
                error: (error) => {
                    this.errorMessage = 'Failed to update tax credit: ' + error.message;
                    this.loading = false;
                }
            });
        } else {
            // Create new tax credit
            this.invoiceService.createTaxCredit(this.invoiceId, taxCreditData).subscribe({
                next: () => {
                    this.loadTaxCredits();
                    this.cancelForm();
                    this.loading = false;
                    this.taxUpdated.emit(this.invoiceId);
                },
                error: (error) => {
                    this.errorMessage = 'Failed to create tax credit: ' + error.message;
                    this.loading = false;
                }
            });
        }
    }

    /**
     * Delete a tax credit
     */
    deleteTaxCredit(taxCreditId: number) {
        if (!confirm('Are you sure you want to delete this tax credit record?')) {
            return;
        }

        this.loading = true;
        this.invoiceService.deleteTaxCredit(taxCreditId).subscribe({
            next: () => {
                this.loadTaxCredits();
                this.loading = false;
                this.taxUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to delete tax credit: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Mark tax as filed by vendor
     */
    markAsFiled(taxCreditId: number) {
        this.loading = true;
        this.invoiceService.markTaxFiled(taxCreditId).subscribe({
            next: () => {
                this.loadTaxCredits();
                this.loading = false;
                this.taxUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to mark as filed: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Mark tax as reflected in GSTR-2A
     */
    markAsReflectedIn2A(taxCreditId: number) {
        this.loading = true;
        this.invoiceService.markTaxReflectedIn2A(taxCreditId).subscribe({
            next: () => {
                this.loadTaxCredits();
                this.loading = false;
                this.taxUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to mark as reflected: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Mark tax as claimed
     */
    markAsClaimed(taxCreditId: number) {
        const returnPeriod = prompt('Enter the GSTR-3B return period (e.g., 2025-01):');
        if (!returnPeriod) return;

        this.loading = true;
        this.invoiceService.markTaxClaimed(taxCreditId, returnPeriod).subscribe({
            next: () => {
                this.loadTaxCredits();
                this.loading = false;
                this.taxUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to mark as claimed: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Report tax mismatch
     */
    reportMismatch(taxCreditId: number) {
        const reason = prompt('Enter mismatch reason:');
        if (!reason) return;

        const amountStr = prompt('Enter mismatch amount:');
        if (!amountStr) return;

        const amount = parseFloat(amountStr);

        this.loading = true;
        this.invoiceService.reportTaxMismatch(taxCreditId, { reason, amount }).subscribe({
            next: () => {
                this.loadTaxCredits();
                this.loading = false;
                this.taxUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to report mismatch: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Resolve tax mismatch
     */
    resolveMismatch(taxCreditId: number) {
        const resolutionNotes = prompt('Enter resolution notes:');
        if (!resolutionNotes) return;

        this.loading = true;
        this.invoiceService.resolveTaxMismatch(taxCreditId, resolutionNotes).subscribe({
            next: () => {
                this.loadTaxCredits();
                this.loading = false;
                this.taxUpdated.emit(this.invoiceId);
            },
            error: (error) => {
                this.errorMessage = 'Failed to resolve mismatch: ' + error.message;
                this.loading = false;
            }
        });
    }

    /**
     * Get filing status badge class
     */
    getFilingStatusBadgeClass(status: string): string {
        switch (status) {
            case 'CLAIMED': return 'badge bg-success';
            case 'REFLECTED_IN_2A': return 'badge bg-info';
            case 'FILED_BY_VENDOR': return 'badge bg-primary';
            case 'PENDING': return 'badge bg-warning text-dark';
            default: return 'badge bg-secondary';
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString: string): string {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    }

    /**
     * Format month for display
     */
    formatMonth(dateString: string): string {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    }

    /**
     * Format amount for display
     */
    formatAmount(amount: number): string {
        if (!amount) return '0.00';
        return amount.toFixed(2);
    }
}
