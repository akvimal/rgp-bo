import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { PeekAddressService } from "src/app/shared/peek-address.service";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest } from "rxjs";
import { InvoiceService } from "../invoices.service";
import { VendorsService } from "../../vendors/vendors.service";
import { AuthService } from "src/app/@core/auth/auth.service";

/** the invoice date a year back: what the list shows by default (unpaid invoices stay in the list whatever their date) */
export function yearAgo(today: Date = new Date()): string {
    const d = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const VIEWS = ["all", "pending", "overdue", "due7", "hold", "paid", "draft", "awaiting", "approval", "ready", "ready_overdue", "ready_due7", "ready_later", "notready"];
const MODES = ["Cash", "Transfer", "Cheque", "UPI", "Card"];
const COMM_STATUSES = ["Not Sent", "Sent", "Acknowledged", "Disputed"];
const COMM_CHANNELS = ["WhatsApp", "SMS", "Email", "Call", "Other"];

@Component({
    templateUrl: 'invoice-list.component.html'
})
export class InvoiceListComponent implements OnInit, OnDestroy {

    readonly modes = MODES;
    readonly pageSizes = [10, 25, 50, 100];

    isOutstanding = false;           // reached through the Outstanding tab: starts on Pending
    isQueue = false;                 // the Payment queue tab: what can be paid now, grouped by vendor
    view = 'all';
    vendorId: number | null = null;
    vendors: any[] = [];
    from = '';
    to = '';
    /** off: invoices of the last year, and any older one that is still owed; on: every year */
    allYears = false;
    private vendorsLoaded = false;
    q = '';
    product = '';
    // more filters: when it falls due, when it was marked ready, how much
    due = '';
    readyFrom = '';
    readyTo = '';
    minAmt: any = '';
    maxAmt: any = '';
    showMore = false;

    invoices: any[] = [];
    total = 0;
    page = 1;
    rows = 25;
    sortField = '';
    sortDir: 'asc' | 'desc' = 'desc';
    loading = false;
    summary: any = null;

    /** the Ready to pay card is the current view (it, or one of its three parts; everything owed is also shown against it) */
    get readyView(): boolean { return this.view === 'pending' || this.view.startsWith('ready'); }
    /** the Held up card is the current view */
    get heldView(): boolean { return ['notready', 'hold', 'approval', 'awaiting'].includes(this.view); }
    /** how many invoices are held up: on hold, waiting for approval (when that is on), or waiting for the vendor's invoice */
    get heldCount(): number {
        const s = this.summary;
        return s ? (s.notready?.count || 0) + (s.hold?.count || 0) + (this.approval.enabled ? (s.approval?.count || 0) : 0) + (s.awaiting?.count || 0) : 0;
    }
    message = '';
    error = '';

    // pay dialog
    payInv: any = null;
    pay: any = { paydate: '', amount: null, paymode: 'Transfer', transref: '', remarks: '', communicationstatus: 'Not Sent', communicationchannel: '' };
    readonly commStatuses = COMM_STATUSES;
    readonly commChannels = COMM_CHANNELS;
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

    // invoice totals check (Business Head): invoices whose amount payable is not what their lines come to
    totals: any = { open: false, loading: false, fixing: false, rows: [], checked: 0, error: '', done: null, lines: [], lineDone: null };

    get lineInvoiceIds(): number[] { return Array.from(new Set((this.totals.lines || []).map((l: any) => +l.invoice_id))) as number[]; }

    get fixableTotals(): any[] { return (this.totals.rows || []).filter((r: any) => r.kind === 'TOTAL'); }

    openTotals() {
        this.totals = { open: true, loading: true, fixing: false, rows: [], checked: 0, error: '', done: null, lines: [], lineDone: null };
        this.service.lineTotalCheck().subscribe((r: any) => { this.totals.lines = r.rows || []; }, () => {});
        this.service.totalCheck().subscribe(
            (r: any) => { this.totals.loading = false; this.totals.rows = r.rows || []; this.totals.checked = r.checked || 0; },
            (e: any) => { this.totals.loading = false; this.totals.error = e?.error?.message || 'The check could not be done.'; });
    }

    fixTotals() {
        const ids = this.fixableTotals.map((r: any) => r.id);
        if (!ids.length || this.totals.fixing) return;
        this.totals.fixing = true; this.totals.error = '';
        this.service.totalFix(ids, true).subscribe(
            (r: any) => { this.totals.fixing = false; this.totals.done = r.results || []; this.reload(); this.openTotalsAgain(); },
            (e: any) => { this.totals.fixing = false; this.totals.error = e?.error?.message || 'The totals could not be corrected.'; });
    }

    fixLines() {
        const ids = this.lineInvoiceIds;
        if (!ids.length || this.totals.fixing) return;
        this.totals.fixing = true; this.totals.error = '';
        this.service.lineTotalFix(ids, true).subscribe(
            (r: any) => { this.totals.fixing = false; this.totals.lineDone = r.results || []; this.reload(); this.service.lineTotalCheck().subscribe((x: any) => { this.totals.lines = x.rows || []; }); this.openTotalsAgain(); },
            (e: any) => { this.totals.fixing = false; this.totals.error = e?.error?.message || 'The line totals could not be corrected.'; });
    }

    /** after a correction: look again, and keep what was done on show */
    private openTotalsAgain() {
        const done = this.totals.done;
        this.service.totalCheck().subscribe((r: any) => { this.totals.rows = r.rows || []; this.totals.checked = r.checked || 0; this.totals.done = done; }, () => {});
    }

    // approval for payment (off unless the business switches it on)
    approval: any = { enabled: false, limit: 0, canmanage: false };
    ruleOpen = false;
    rule: any = { enabled: false, limit: 0 };
    ruleError = '';

    // hold dialog
    holdInv: any = null;
    deleteInv: any = null;
    deleteError = '';
    holdReason = '';
    holdError = '';

    /** the invoice open in the side panel, kept in the address (?peek=12) so Back closes it */
    peekId: number | null = null;
    private peekSub?: Subscription;
    /** what the list is filtered by, so opening a panel (which only adds ?peek=) does not reload the page or send it back to page one */
    private lastKey = '';

    constructor(private service: InvoiceService, private route: ActivatedRoute, private router: Router, private vendorsService: VendorsService, private peekAddress: PeekAddressService, private auth: AuthService) {}

    /** recording and changing a payment, and reversing one, are their own actions (MENU_AND_PERMISSIONS step D, Purchasing) */
    get mayRecord(): boolean { return this.auth.isActionAuthorized('purchases.payments.record'); }
    get mayReverse(): boolean { return this.auth.isActionAuthorized('purchases.payments.reverse'); }

    /** the row of the open panel, from the page shown (an invoice on another page shows no panel) */
    get peekInvoice(): any { return this.peekId ? this.invoices.find((i: any) => i.id === this.peekId) || null : null; }
    openPeek(id: number) { this.peekAddress.open(id); }
    closePeek() { this.peekAddress.close(); }
    ngOnDestroy() { this.peekSub?.unsubscribe(); }

    ngOnInit() {
        this.peekSub = this.peekAddress.peek$.subscribe(v => this.peekId = v && /^\d+$/.test(v) ? Number(v) : null);
        this.loadApproval();
        combineLatest([this.route.url, this.route.queryParamMap]).subscribe(([segments, q]) => {
            const key = `${segments?.[0]?.path}|${q.get('vendor')}|${q.get('view')}`;
            if (key === this.lastKey) return;
            this.lastKey = key;
            this.isOutstanding = segments?.[0]?.path === 'outstanding';
            this.isQueue = segments?.[0]?.path === 'queue';
            const v = q.get('vendor');
            this.vendorId = v && /^[0-9]+$/.test(v) ? +v : null;
            const view = q.get('view');
            this.view = this.isQueue ? 'ready' : view && VIEWS.includes(view) ? view : this.baseView;
            this.page = 1;
            this.clearSelection();
            if (!this.vendorsLoaded) { this.vendorsLoaded = true; this.loadVendors(); }
            this.reload();
        });
    }

    // ---------------------------------------------------------------- which tab the list opens on
    private readonly viewKey = 'rgp_invoice_view';
    /**
     * Where the list opens when no tab is asked for: the one this person used last, else by what they do. Finance (who may record payments) lands on
     * what is ready to pay, the person who receives goods on what still needs marking, anyone else on everything.
     */
    get baseView(): string {
        if (this.isOutstanding) return 'pending';
        try { const v = localStorage.getItem(this.viewKey); if (v && VIEWS.includes(v) && v !== 'pending') return v; } catch { /* storage blocked: the role decides */ }
        if (this.mayRecord) return 'ready';
        if (this.auth.isActionAuthorized('purchases.add')) return 'notready';
        return 'all';
    }

    /** only the vendors that have invoices in the window being looked at, so the dropdown (and what is fetched) stays short */
    private loadVendors(retry = true) {
        this.service.vendorsIn(this.windowParams()).subscribe(v => {
            this.vendors = v || [];
            // a vendor chosen from elsewhere (a link, an old bookmark) whose invoices are all older: widen to every year rather than show an empty choice
            if (retry && this.vendorId && !this.allYears && !this.vendors.some((x: any) => x.id === this.vendorId)) {
                this.allYears = true;
                this.loadVendors(false);
                this.reload();
            }
        }, () => {});
    }

    // ---------------------------------------------------------------- loading
    /** the date window: the dates typed, else the last year unless every year is asked for */
    private windowParams(): any {
        const p: any = {};
        if (this.from) p.from = this.from;
        if (this.to) p.to = this.to;
        if (!this.from && !this.allYears) p.since = yearAgo();
        return p;
    }

    private filterParams(): any {
        const p: any = this.windowParams();
        if (this.vendorId) p.vendor = String(this.vendorId);
        if ((this.q || '').trim()) p.q = this.q.trim();
        if ((this.product || '').trim()) p.product = this.product.trim();
        if (this.due) p.due = this.due;
        if (this.readyFrom) p.readyfrom = this.readyFrom;
        if (this.readyTo) p.readyto = this.readyTo;
        if (this.minAmt !== '' && this.minAmt !== null && +this.minAmt >= 0) p.min = String(+this.minAmt);
        if (this.maxAmt !== '' && this.maxAmt !== null && +this.maxAmt > 0) p.max = String(+this.maxAmt);
        return p;
    }

    reload() {
        this.loading = true;
        this.error = '';
        const filters = this.filterParams();
        if (this.isQueue) {
            this.service.paymentQueue(filters).subscribe(
                (q: any) => { this.queue = q; this.loading = false; this.dropGone(); },
                err => { this.loading = false; this.error = this.msg(err, 'Could not load the payment queue.'); });
            return;
        }
        this.service.summary(filters).subscribe(s => this.summary = s, () => {});
        const params: any = { ...filters, view: this.view, page: String(this.page), limit: String(this.rows) };
        if (this.sortField) { params.sort = this.sortField; params.dir = this.sortDir; }
        this.service.search(params).subscribe(
            (res: any) => { this.invoices = res.data || []; this.total = res.total || 0; this.loading = false; this.dropGone(); },
            err => { this.loading = false; this.error = this.msg(err, 'Could not load the invoices.'); });
    }

    // ---------------------------------------------------------------- navigation inside the list
    setView(view: string) {
        if (!this.isOutstanding) { try { localStorage.setItem(this.viewKey, view); } catch { /* not remembered */ } }
        this.router.navigate([], { relativeTo: this.route, queryParams: { view }, queryParamsHandling: 'merge' });
    }

    setVendor(id: any) {
        this.router.navigate([], { relativeTo: this.route, queryParams: { vendor: id ? id : null }, queryParamsHandling: 'merge' });
    }

    applyFilters() { this.page = 1; this.loadVendors(); this.reload(); }

    /** the "Show all years" box */
    setAllYears(on: boolean) { this.allYears = on; this.applyFilters(); }

    clearFilters() {
        this.from = ''; this.to = ''; this.q = ''; this.product = ''; this.allYears = false;
        this.due = ''; this.readyFrom = ''; this.readyTo = ''; this.minAmt = ''; this.maxAmt = '';
        this.router.navigate([], { relativeTo: this.route, queryParams: { vendor: null, view: null }, queryParamsHandling: 'merge' });
    }

    get hasFilters(): boolean { return !!(this.vendorId || this.from || this.to || this.q || this.product || this.allYears || this.due || this.readyFrom || this.readyTo || this.minAmt !== '' || this.maxAmt !== ''); }
    get moreCount(): number { return [this.due, this.readyFrom, this.readyTo, this.minAmt !== '' ? 'x' : '', this.maxAmt !== '' ? 'x' : ''].filter(Boolean).length; }

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

    // ---------------------------------------------------------------- the stage of an invoice, as it is shown
    /** what the Payment column says: a marked invoice reads Ready for payment, an unmarked one Needs marking */
    payLabel(p: any): string {
        if (p.payment_status === 'Not ready') return 'Needs marking';
        if (p.payment_ready && p.payment_status === 'Unpaid') return 'Ready for payment';
        return p.payment_status;
    }

    /** whole days since it was marked ready */
    readyDays(p: any): number | null {
        if (!p?.ready_on) return null;
        return Math.max(0, Math.floor((Date.now() - new Date(p.ready_on).getTime()) / 86400000));
    }

    readyAgo(p: any): string { const d = this.readyDays(p); return d === null ? '' : d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} ago`; }

    // ---------------------------------------------------------------- choosing several invoices (the ones to mark, or to pay)
    /** the invoice rows are chosen only where there is something to do with them: mark them ready, or pay or withdraw them */
    get canSelect(): boolean { return this.isQueue || this.view === 'notready' || (this.view.startsWith('ready') && this.view !== 'pending'); }
    get selectMode(): 'mark' | 'pay' { return this.isQueue || this.view.startsWith('ready') ? 'pay' : 'mark'; }

    selected = new Map<number, any>();
    bulkNote = '';
    bulkBusy = false;

    isSelected(id: number): boolean { return this.selected.has(id); }
    toggleRow(p: any) { if (this.selected.has(p.id)) this.selected.delete(p.id); else this.selected.set(p.id, p); }
    get selCount(): number { return this.selected.size; }
    get selBalance(): number { let t = 0; this.selected.forEach((r) => t += +r.balance_amount || 0); return Math.round(t * 100) / 100; }
    clearSelection() { this.selected = new Map<number, any>(); }

    get pageRows(): any[] { return this.isQueue ? this.queueRows : this.invoices; }
    get allPicked(): boolean { const rows = this.pageRows; return rows.length > 0 && rows.every((r: any) => this.selected.has(r.id)); }
    togglePage() { const on = !this.allPicked; this.pageRows.forEach((r: any) => on ? this.selected.set(r.id, r) : this.selected.delete(r.id)); }

    /** a chosen invoice that is no longer in the list (it was paid, or marked) leaves the choice */
    private dropGone() {
        const have = new Set<number>(this.pageRows.map((r: any) => r.id));
        if (!this.isQueue) return;               // the list is paged: a choice made on another page stays
        Array.from(this.selected.keys()).forEach((id) => { if (!have.has(id)) this.selected.delete(id); });
    }

    markSelected() {
        if (!this.selCount || this.bulkBusy) return;
        this.bulkBusy = true; this.error = '';
        this.service.markReadyBulk(Array.from(this.selected.keys()), this.bulkNote.trim() || undefined).subscribe((r: any) => {
            this.bulkBusy = false; this.bulkNote = '';
            this.message = `${r.done} invoice${r.done === 1 ? '' : 's'} marked ready for payment.` + (r.skipped?.length ? ` ${r.skipped.length} could not be marked: ${r.skipped.map((x: any) => (x.invoice_no || x.id) + ' (' + x.reason + ')').join('; ')}` : '');
            this.clearSelection(); this.reload();
        }, err => { this.bulkBusy = false; this.error = this.msg(err, 'Could not mark the invoices.'); });
    }

    withdrawSelected() {
        if (!this.selCount || this.bulkBusy) return;
        this.bulkBusy = true; this.error = '';
        this.service.unmarkReadyBulk(Array.from(this.selected.keys())).subscribe((r: any) => {
            this.bulkBusy = false;
            this.message = `${r.done} invoice${r.done === 1 ? '' : 's'} taken back to Needs marking.` + (r.skipped?.length ? ` ${r.skipped.length} stay ready: ${r.skipped.map((x: any) => (x.invoice_no || x.id) + ' (' + x.reason + ')').join('; ')}` : '');
            this.clearSelection(); this.reload();
        }, err => { this.bulkBusy = false; this.error = this.msg(err, 'Could not take the mark back.'); });
    }

    // ---------------------------------------------------------------- the payment queue (grouped by vendor)
    queue: any = null;
    get queueRows(): any[] { return (this.queue?.vendors || []).reduce((all: any[], v: any) => all.concat(v.invoices), []); }
    vendorPicked(v: any): boolean { return v.invoices.length > 0 && v.invoices.every((i: any) => this.selected.has(i.id)); }
    toggleVendor(v: any) { const on = !this.vendorPicked(v); v.invoices.forEach((i: any) => on ? this.selected.set(i.id, i) : this.selected.delete(i.id)); }

    // ---------------------------------------------------------------- pay the chosen invoices (one pay run per vendor)
    bulkPay: any = null;

    get mayPaySelected(): boolean { return this.mayRecord && this.selectMode === 'pay' && this.selCount > 0; }

    openBulkPay() {
        const rows = Array.from(this.selected.values()).map((r: any) => ({ inv: r, amount: +r.balance_amount }));
        if (!rows.length) return;
        this.bulkPay = { rows, paydate: new Date().toISOString().slice(0, 10), paymode: 'Transfer', transref: '', remarks: '', error: '', busy: false };
    }

    get bulkPayTotal(): number { return Math.round((this.bulkPay?.rows || []).reduce((t: number, r: any) => t + (+r.amount > 0 ? +r.amount : 0), 0) * 100) / 100; }
    get bulkPayVendors(): number { return new Set((this.bulkPay?.rows || []).map((r: any) => r.inv.vendor_id)).size; }

    saveBulkPay() {
        const b = this.bulkPay;
        if (!b || b.busy) return;
        const rows = b.rows.filter((r: any) => +r.amount > 0);
        if (!rows.length) { b.error = 'Enter an amount for at least one invoice.'; return; }
        const over = rows.find((r: any) => +r.amount > +r.inv.balance_amount + 1.005);
        if (over) { b.error = `${over.inv.invoice_no}: the amount is more than the balance (${over.inv.balance_amount}).`; return; }
        if (!b.paymode) { b.error = 'Choose how it was paid.'; return; }
        const byVendor = new Map<number, any[]>();
        rows.forEach((r: any) => byVendor.set(r.inv.vendor_id, [...(byVendor.get(r.inv.vendor_id) || []), r]));
        b.busy = true; b.error = '';
        const vendors = Array.from(byVendor.entries());
        let paid = 0, count = 0;
        const next = (i: number) => {
            if (i >= vendors.length) {
                b.busy = false; this.bulkPay = null;
                this.message = `${count} invoice${count === 1 ? '' : 's'} paid, Rs ${Math.round(paid).toLocaleString('en-IN')} in all.`;
                this.clearSelection(); this.reload(); return;
            }
            const [vendorid, list] = vendors[i];
            this.service.payRun({
                vendorid, paydate: b.paydate, paymode: b.paymode, transref: b.transref, remarks: b.remarks,
                allocations: list.map((r: any) => ({ invoiceid: r.inv.id, amount: +r.amount })),
            }).subscribe((res: any) => { paid += +res?.total || 0; count += list.length; list.forEach((r: any) => this.selected.delete(r.inv.id)); b.rows = b.rows.filter((r: any) => !list.includes(r)); next(i + 1); },
                err => { b.busy = false; b.error = this.msg(err, 'The payment could not be recorded.') + (count ? ` ${count} invoice${count === 1 ? ' was' : 's were'} already paid; the rest are still listed.` : ''); if (count) this.reload(); });
        };
        next(0);
    }

    // ---------------------------------------------------------------- pay
    canPay(inv: any): boolean {
        return this.mayRecord && ['Unpaid', 'Part Paid', 'Overdue'].includes(inv.payment_status) && inv.balance_amount > 0;
    }

    openPay(inv: any) {
        this.payInv = inv;
        this.pay = { paydate: new Date().toISOString().slice(0, 10), amount: inv.balance_amount, paymode: 'Transfer', transref: '', remarks: '', communicationstatus: 'Not Sent', communicationchannel: '' };
        this.payError = '';
    }

    savePay() {
        this.payError = '';
        const amount = +this.pay.amount;
        if (!(amount > 0)) { this.payError = 'Enter the amount paid.'; return; }
        if (amount > this.payInv.balance_amount + 1.005) { this.payError = `The amount is more than the balance (${this.payInv.balance_amount}).`; return; }
        if (!this.pay.paymode) { this.payError = 'Choose how it was paid.'; return; }
        this.paying = true;
        this.service.savePayment({
            vendorid: this.payInv.vendor_id, invoiceid: this.payInv.id, paydate: this.pay.paydate, amount,
            paymode: this.pay.paymode, transref: this.pay.transref, remarks: this.pay.remarks,
            communicationstatus: this.pay.communicationstatus || 'Not Sent', communicationchannel: this.pay.communicationchannel || undefined,
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
        this.edit = { paymode: p.paymode, transref: p.transref || '', paydate: p.paydate, remarks: p.remarks || '', communicationstatus: p.communicationstatus || 'Not Sent', communicationchannel: p.communicationchannel || '' };
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

    // ---------------------------------------------------------------- the step after completing: ready for payment
    markReady(inv: any) {
        this.error = '';
        this.service.markReady(inv.id).subscribe(
            () => { this.message = `${inv.invoice_no} marked ready for payment.`; this.reload(); },
            err => { this.error = this.msg(err, 'Could not mark the invoice ready for payment.'); });
    }

    // ---------------------------------------------------------------- approval for payment
    loadApproval() { this.service.approvalSettings().subscribe(a => this.approval = a, () => {}); }

    approveInv(inv: any) {
        this.error = '';
        this.service.approve(inv.id).subscribe(
            () => { this.message = `${inv.invoice_no} approved for payment.`; this.reload(); },
            err => { this.error = this.msg(err, 'Could not approve the invoice.'); });
    }

    unapproveInv(inv: any) {
        this.error = '';
        this.service.unapprove(inv.id).subscribe(
            () => { this.message = `Approval of ${inv.invoice_no} withdrawn.`; this.reload(); },
            err => { this.error = this.msg(err, 'Could not withdraw the approval.'); });
    }

    openRule() { this.rule = { enabled: !!this.approval.enabled, limit: this.approval.limit || 0 }; this.ruleError = ''; this.ruleOpen = true; }

    saveRule() {
        const limit = Number(this.rule.limit || 0);
        if (!Number.isFinite(limit) || limit < 0) { this.ruleError = 'The limit cannot be negative.'; return; }
        this.service.setApprovalSettings({ enabled: !!this.rule.enabled, limit }).subscribe(
            () => { this.ruleOpen = false; this.message = this.rule.enabled ? 'Invoices now need approval before they can be paid.' : 'Approval for payment is off.'; this.loadApproval(); this.reload(); },
            err => { this.ruleError = this.msg(err, 'Could not save the rule.'); });
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
            : s === 'On Hold' ? 'bg-warning text-dark' : s === 'Needs marking' ? 'bg-warning text-dark' : s === 'Ready for payment' ? 'bg-success' : s === 'Not ready' ? 'bg-info text-dark' : s === 'Awaiting approval' ? 'bg-primary' : s === 'Awaiting invoice' ? 'bg-dark' : s === 'Draft' ? 'bg-light text-dark border' : 'bg-secondary';
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
