import { Component } from "@angular/core";
import { InvoiceService } from "../invoices.service";

interface PayableInvoice {
    id: number;
    invoice_no: string;
    invoice_date: string;
    due_date: string;
    balance_amount: number;
    payment_status: string;
    checked?: boolean;
    payamount?: number;
}

@Component({
    templateUrl: './payables.component.html'
})
export class PayablesComponent {

    vendors: any[] = [];
    loading = false;
    message = '';

    // pay-run dialog state
    showPay = false;
    payVendor: any = null;
    payInvoices: PayableInvoice[] = [];
    payAvailable: number | null = null;
    payForm = { paydate: this.today(), paymode: '', transref: '', remarks: '' };
    saving = false;

    constructor(private service: InvoiceService) {}

    ngOnInit() {
        this.refresh();
    }

    refresh() {
        this.loading = true;
        this.service.findPayables().subscribe({
            next: (data: any) => { this.vendors = data || []; this.loading = false; },
            error: () => this.loading = false,
        });
    }

    get totals() {
        return this.vendors.reduce((acc, v) => ({
            vendorCount: acc.vendorCount + 1,
            outstanding: acc.outstanding + Number(v.total_outstanding || 0),
            overdue: acc.overdue + Number(v.total_overdue || 0),
        }), { vendorCount: 0, outstanding: 0, overdue: 0 });
    }

    private today() {
        return new Date().toISOString().slice(0, 10);
    }

    openPay(vendor: any) {
        this.message = '';
        this.payVendor = vendor;
        this.payAvailable = null;
        this.payForm = { paydate: this.today(), paymode: '', transref: '', remarks: '' };
        this.payInvoices = [];
        this.showPay = true;
        this.service.findOutstanding({ vendorid: vendor.vendor_id }).subscribe((rows: any) => {
            this.payInvoices = (rows || [])
                .filter((r: any) => r.payment_status !== 'On Hold')
                .sort((a: any, b: any) => (a.due_date || '').localeCompare(b.due_date || ''))
                .map((r: any) => ({ ...r, checked: false, payamount: 0 }));
        });
    }

    closePay() {
        this.showPay = false;
        this.payVendor = null;
    }

    toggle(row: PayableInvoice) {
        row.checked = !row.checked;
        row.payamount = row.checked ? Number(row.balance_amount) : 0;
    }

    /** distribute the available amount oldest-first, capping each line at its balance */
    autoAllocate() {
        let left = Number(this.payAvailable || 0);
        for (const row of this.payInvoices) {
            if (left <= 0) {
                row.checked = false;
                row.payamount = 0;
                continue;
            }
            const take = Math.min(left, Number(row.balance_amount));
            row.payamount = +take.toFixed(2);
            row.checked = take > 0;
            left = +(left - take).toFixed(2);
        }
    }

    get selectedTotal(): number {
        return this.payInvoices
            .filter(r => r.checked)
            .reduce((sum, r) => sum + Number(r.payamount || 0), 0);
    }

    get canSubmit(): boolean {
        return !!this.payForm.paymode && this.selectedTotal > 0
            && this.payInvoices.filter(r => r.checked).every(r => Number(r.payamount) > 0 && Number(r.payamount) <= Number(r.balance_amount) + 0.5);
    }

    submitPayRun() {
        if (!this.canSubmit) { return; }
        this.saving = true;
        this.message = '';
        const allocations = this.payInvoices
            .filter(r => r.checked && Number(r.payamount) > 0)
            .map(r => ({ invoiceid: r.id, amount: +Number(r.payamount).toFixed(2) }));

        this.service.payRun({
            vendorid: this.payVendor.vendor_id,
            paydate: this.payForm.paydate,
            paymode: this.payForm.paymode,
            transref: this.payForm.transref,
            remarks: this.payForm.remarks,
            allocations,
        }).subscribe({
            next: (result: any) => {
                this.saving = false;
                this.message = `Paid ${result.count} invoice(s), total ${result.total?.toFixed?.(2) ?? result.total}.`;
                this.closePay();
                this.refresh();
            },
            error: (err) => {
                this.saving = false;
                this.message = err?.error?.message || 'Unable to record the payment run.';
            }
        });
    }
}
