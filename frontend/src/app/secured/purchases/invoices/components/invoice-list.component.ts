import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest } from "rxjs";
import { InvoiceService } from "../invoices.service";
import { VendorsService } from "../../vendors/vendors.service";

const VIEWS = ["all", "pending", "overdue", "due7", "hold", "paid", "draft"];
const MODES = ["Cash", "Transfer", "Cheque", "UPI", "Card"];

@Component({
    templateUrl: 'invoice-list.component.html'
})
export class InvoiceListComponent implements OnInit {

    readonly modes = MODES;
    readonly pageSizes = [10, 25, 50, 100];

    isOutstanding = false;           // reached through the Outstanding tab: starts on Pending
    view = 'all';
    vendorId: number | null = null;
    vendors: any[] = [];
    from = '';
    to = '';
    q = '';

    invoices: any[] = [];
    total = 0;
    page = 1;
    rows = 25;
    sortField = '';
    sortDir: 'asc' | 'desc' = 'desc';
    loading = false;
    summary: any = null;
    message = '';
    error = '';

    // pay dialog
    payInv: any = null;
    pay: any = { paydate: '', amount: null, paymode: 'Transfer', transref: '', remarks: '' };
    payError = '';
    paying = false;

    // payment history dialog
    histInv: any = null;
    payments: any[] = [];
    editId: number | null = null;
    edit: any = {};
    editError = '';
    reversing: any = null;
    reverseReason = '';

    // hold dialog
    holdInv: any = null;
    deleteInv: any = null;
    deleteError = '';
    holdReason = '';
    holdError = '';

    constructor(private service: InvoiceService, private route: ActivatedRoute, private router: Router, private vendorsService: VendorsService) {}

    ngOnInit() {
        this.vendorsService.findAll('all').subscribe(v => this.vendors = (v || []).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')), () => {});
        combineLatest([this.route.url, this.route.queryParamMap]).subscribe(([segments, q]) => {
            this.isOutstanding = segments?.[0]?.path === 'outstanding';
            const v = q.get('vendor');
            this.vendorId = v && /^[0-9]+$/.test(v) ? +v : null;
            const view = q.get('view');
            this.view = view && VIEWS.includes(view) ? view : (this.isOutstanding ? 'pending' : 'all');
            this.page = 1;
            this.reload();
        });
    }

    // ---------------------------------------------------------------- loading
    private filterParams(): any {
        const p: any = {};
        if (this.vendorId) p.vendor = String(this.vendorId);
        if (this.from) p.from = this.from;
        if (this.to) p.to = this.to;
        if ((this.q || '').trim()) p.q = this.q.trim();
        return p;
    }

    reload() {
        this.loading = true;
        this.error = '';
        const filters = this.filterParams();
        this.service.summary(filters).subscribe(s => this.summary = s, () => {});
        const params: any = { ...filters, view: this.view, page: String(this.page), limit: String(this.rows) };
        if (this.sortField) { params.sort = this.sortField; params.dir = this.sortDir; }
        this.service.search(params).subscribe(
            (res: any) => { this.invoices = res.data || []; this.total = res.total || 0; this.loading = false; },
            err => { this.loading = false; this.error = this.msg(err, 'Could not load the invoices.'); });
    }

    // ---------------------------------------------------------------- navigation inside the list
    setView(view: string) {
        this.router.navigate([], { relativeTo: this.route, queryParams: { view: view === (this.isOutstanding ? 'pending' : 'all') ? null : view }, queryParamsHandling: 'merge' });
    }

    setVendor(id: any) {
        this.router.navigate([], { relativeTo: this.route, queryParams: { vendor: id ? id : null }, queryParamsHandling: 'merge' });
    }

    applyFilters() { this.page = 1; this.reload(); }

    clearFilters() {
        this.from = ''; this.to = ''; this.q = '';
        this.router.navigate([], { relativeTo: this.route, queryParams: { vendor: null, view: null }, queryParamsHandling: 'merge' });
    }

    get hasFilters(): boolean { return !!(this.vendorId || this.from || this.to || this.q); }

    sortBy(field: string) {
        if (this.sortField === field) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        else { this.sortField = field; this.sortDir = field === 'business_name' || field === 'invoice_no' ? 'asc' : 'desc'; }
        this.page = 1;
        this.reload();
    }

    sortIcon(field: string): string {
        return this.sortField !== field ? '' : this.sortDir === 'asc' ? '▲' : '▼';
    }

    get pages(): number { return Math.max(1, Math.ceil(this.total / this.rows)); }

    go(delta: number) {
        const next = this.page + delta;
        if (next < 1 || next > this.pages) return;
        this.page = next;
        this.reload();
    }

    changeRows() { this.page = 1; this.reload(); }

    // ---------------------------------------------------------------- pay
    canPay(inv: any): boolean {
        return ['Unpaid', 'Part Paid', 'Overdue'].includes(inv.payment_status) && inv.balance_amount > 0;
    }

    openPay(inv: any) {
        this.payInv = inv;
        this.pay = { paydate: new Date().toISOString().slice(0, 10), amount: inv.balance_amount, paymode: 'Transfer', transref: '', remarks: '' };
        this.payError = '';
    }

    savePay() {
        this.payError = '';
        const amount = +this.pay.amount;
        if (!(amount > 0)) { this.payError = 'Enter the amount paid.'; return; }
        if (amount > this.payInv.balance_amount + 0.5) { this.payError = `The amount is more than the balance (${this.payInv.balance_amount}).`; return; }
        if (!this.pay.paymode) { this.payError = 'Choose how it was paid.'; return; }
        this.paying = true;
        this.service.savePayment({
            vendorid: this.payInv.vendor_id, invoiceid: this.payInv.id, paydate: this.pay.paydate, amount,
            paymode: this.pay.paymode, transref: this.pay.transref, remarks: this.pay.remarks,
        } as any).subscribe(
            () => { this.paying = false; this.message = `Payment of ${amount} recorded against ${this.payInv.invoice_no}.`; this.payInv = null; this.reload(); },
            err => { this.paying = false; this.payError = this.msg(err, 'Could not record the payment.'); });
    }

    // ---------------------------------------------------------------- history, edit, reverse
    openHistory(inv: any) {
        this.histInv = inv;
        this.editId = null;
        this.reversing = null;
        this.loadPayments();
    }

    private loadPayments() {
        this.service.paymentsOf(this.histInv.id).subscribe((p: any) => this.payments = p || [], () => this.payments = []);
    }

    isEditable(p: any): boolean { return p.status !== 'REVERSED' && !p.reversesid; }

    startEdit(p: any) {
        this.editId = p.id;
        this.editError = '';
        this.edit = { paymode: p.paymode, transref: p.transref || '', paydate: p.paydate, remarks: p.remarks || '' };
    }

    modeOptions(): string[] {
        return this.edit.paymode && !MODES.includes(this.edit.paymode) ? [this.edit.paymode, ...MODES] : MODES;
    }

    saveEdit() {
        this.editError = '';
        this.service.updatePaymentInfo(this.editId as number, this.edit).subscribe(
            () => { this.editId = null; this.message = 'Payment details updated.'; this.loadPayments(); },
            err => { this.editError = this.msg(err, 'Could not update the payment.'); });
    }

    askReverse(p: any) { this.reversing = p; this.reverseReason = ''; this.editError = ''; }

    confirmReverse() {
        this.service.reversePayment(this.reversing.id, (this.reverseReason || '').trim() || undefined).subscribe(
            () => { this.reversing = null; this.message = 'Payment reversed.'; this.loadPayments(); this.reload(); },
            err => { this.editError = this.msg(err, 'Could not reverse the payment.'); });
    }

    // ---------------------------------------------------------------- hold
    openHold(inv: any) { this.holdInv = inv; this.holdReason = ''; this.holdError = ''; }

    saveHold() {
        if ((this.holdReason || '').trim().length < 5) { this.holdError = 'Give a reason of at least 5 characters.'; return; }
        this.service.hold(this.holdInv.id, this.holdReason.trim()).subscribe(
            () => { this.message = `${this.holdInv.invoice_no} is on hold: it cannot be paid until released.`; this.holdInv = null; this.reload(); },
            err => { this.holdError = this.msg(err, 'Could not put the invoice on hold.'); });
    }

    askDelete(inv: any) { this.deleteInv = inv; this.deleteError = ''; }

    confirmDelete() {
        const inv = this.deleteInv;
        this.service.remove(inv.id).subscribe(
            () => { this.message = `Draft invoice ${inv.invoice_no} deleted.`; this.deleteInv = null; this.reload(); },
            err => { this.deleteError = this.msg(err, 'Could not delete the invoice.'); });
    }

    release(inv: any) {
        this.service.release(inv.id).subscribe(
            () => { this.message = `${inv.invoice_no} released from hold.`; this.reload(); },
            err => { this.error = this.msg(err, 'Could not release the invoice.'); });
    }

    // ---------------------------------------------------------------- presentation
    payClass(s: string): string {
        return s === 'Paid' ? 'bg-success' : s === 'Part Paid' ? 'bg-info text-dark' : s === 'Overdue' ? 'bg-danger'
            : s === 'On Hold' ? 'bg-warning text-dark' : s === 'Draft' ? 'bg-light text-dark border' : 'bg-secondary';
    }

    gstLabel(s: string | null): string {
        const m: any = { MATCHED: 'Matched', PROBABLE: 'Probable', MISMATCH: 'Mismatch', MISSING_IN_2B: 'Missing in 2B', EXCLUDED: 'Excluded', DISPUTED: 'Disputed' };
        return s && s !== 'UNRECONCILED' ? (m[s] || s) : 'Not checked';
    }

    gstClass(s: string | null): string {
        return s === 'MATCHED' ? 'bg-success' : s === 'PROBABLE' ? 'bg-info text-dark' : s === 'MISMATCH' || s === 'DISPUTED' ? 'bg-danger'
            : s === 'MISSING_IN_2B' ? 'bg-warning text-dark' : 'bg-light text-muted border';
    }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
