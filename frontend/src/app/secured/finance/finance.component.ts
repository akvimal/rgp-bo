import { Component, OnInit } from "@angular/core";
import { FinanceService } from "./finance.service";
import { AuthService } from "src/app/@core/auth/auth.service";

type Tab = 'overview' | 'lines' | 'reconcile' | 'accounts' | 'records';

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/**
 * Finance. Income and expenses from the books and from the bank side by side; bank lines from statements of any bank, tagged; the month's books
 * compared with the bank (a difference up to the tolerance is accepted, a larger one needs a reason before the month is signed); and the records check.
 */
@Component({
    templateUrl: './finance.component.html'
})
export class FinanceComponent implements OnInit {

    tab: Tab = 'overview';
    error = '';
    message = '';
    tolerance = 100;

    accounts: any[] = [];
    stores: any[] = [];
    tags: any[] = [];
    reasons: { [k: string]: string } = {};
    reasonCodes: string[] = [];

    // overview
    ov: any = null;
    from = '';
    to = '';
    ovStore: number | null = null;
    ovAccount: number | null = null;

    // lines
    ln: any = null;
    lf: any = { account: null, from: '', to: '', status: '', direction: '', q: '' };
    editing: any = null;
    rules: any[] = [];

    // reconcile
    rcAccount: number | null = null;
    rcMonth = '';
    rc: any = null;
    rcReasons: { [k: string]: { code: string; note: string } } = {};
    rcNote = '';
    rcAccept = false;
    reopenReason = '';
    signed: any[] = [];

    // accounts and import
    acc: any = null;
    impAccount: number | null = null;
    impFile: File | null = null;
    pv: any = null;
    mapping: any = null;
    importing = false;
    result: any = null;
    imports: any[] = [];

    // records
    rec: any = null;

    constructor(private service: FinanceService, private auth: AuthService) {}

    ngOnInit() {
        const now = new Date();
        this.setPeriod('month');
        this.rcMonth = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
        this.service.accounts().subscribe((r: any) => {
            this.accounts = r.accounts; this.stores = r.stores; this.tolerance = r.tolerance; this.tags = r.tags; this.reasons = r.reasons; this.reasonCodes = Object.keys(r.reasons);
            const first = this.accounts.find((a) => a.active);
            this.rcAccount = this.impAccount = this.lf.account = first ? first.id : null;
            this.loadOverview();
        }, (e: any) => this.error = this.msg(e, 'Could not load finance.'));
    }

    msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    setTab(t: Tab) {
        this.tab = t; this.error = ''; this.message = '';
        if (t === 'overview') this.loadOverview();
        if (t === 'lines') { this.loadLines(); }
        if (t === 'reconcile') this.loadMonth();
        if (t === 'accounts') { this.loadAccounts(); this.loadRules(); if (this.impAccount) this.loadImports(); }
        if (t === 'records') this.loadRecords();
    }

    tagLabel(t: string | null): string { return (this.tags.find((x) => x.tag === t) || {}).label || t || ''; }

    // ------------------------------------------------------------------ overview
    setPeriod(kind: 'month' | 'last' | 'fy' | 'lastfy') {
        const n = new Date();
        let a: Date, b: Date;
        if (kind === 'month') { a = new Date(n.getFullYear(), n.getMonth(), 1); b = n; }
        else if (kind === 'last') { a = new Date(n.getFullYear(), n.getMonth() - 1, 1); b = new Date(n.getFullYear(), n.getMonth(), 0); }
        else {
            const y = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1;
            const fy = kind === 'fy' ? y : y - 1;
            a = new Date(fy, 3, 1); b = kind === 'fy' ? n : new Date(fy + 1, 2, 31);
        }
        this.from = iso(a); this.to = iso(b);
        if (this.ov !== null) this.loadOverview();
    }

    loadOverview() {
        this.error = '';
        this.service.overview({ from: this.from, to: this.to, storeid: this.ovStore, account: this.ovAccount }).subscribe((r: any) => this.ov = r, (e: any) => this.error = this.msg(e, 'Could not load the overview.'));
    }

    /** what the bank shows paid to vendors in the period, for the note beside the books' figure */
    get bankVendorPaid(): number { return ((this.ov?.bank?.byTag || []).find((t: any) => t.tag === 'VENDOR_PAYMENT') || {}).debit || 0; }

    barWidth(v: number, max: number): number { return max > 0 ? Math.max(1, Math.round((v / max) * 100)) : 0; }
    get trendMax(): number { return Math.max(1, ...(this.ov?.trend || []).flatMap((t: any) => [t.sales, t.purchases, t.expenses, t.bank_in, t.bank_out])); }

    // ------------------------------------------------------------------ lines
    loadLines() {
        this.error = '';
        this.service.lines({ ...this.lf, limit: 400 }).subscribe((r: any) => this.ln = r, (e: any) => this.error = this.msg(e, 'Could not load the bank lines.'));
    }

    edit(l: any) {
        this.editing = { id: l.id, tag: l.tag || '', vendor_id: l.vendor_id || null, category: l.expense_category || '', note: l.note || '', remember: false, pattern: l.counterparty || '', credit: l.credit > 0, narration: l.narration };
    }

    get editTags(): any[] {
        if (!this.editing) return [];
        const incoming = ['DIGITAL_SETTLEMENT', 'CASH_DEPOSIT', 'OTHER_INCOME'];
        const outgoing = ['VENDOR_PAYMENT', 'EXPENSE', 'SALARY', 'GST_TAX', 'BANK_CHARGES', 'OTHER_OUT'];
        return this.tags.filter((t) => this.editing.credit ? (incoming.includes(t.tag) || !outgoing.includes(t.tag)) : !incoming.includes(t.tag));
    }

    saveTag() {
        const e = this.editing;
        this.service.tag(e.id, { tag: e.tag || null, vendor_id: e.vendor_id, category: e.category, note: e.note, remember: e.remember, pattern: e.pattern }).subscribe((r: any) => {
            this.message = r.updated ? `Saved, and ${r.updated} line${r.updated === 1 ? '' : 's'} like it tagged too.` : 'Saved.';
            this.editing = null; this.loadLines(); this.loadAccounts();
        }, (err: any) => this.error = this.msg(err, 'Could not save.'));
    }

    // ------------------------------------------------------------------ reconcile
    loadMonth() {
        this.error = '';
        if (!this.rcAccount || !this.rcMonth) { this.rc = null; return; }
        this.service.month(this.rcAccount, this.rcMonth).subscribe((r: any) => {
            this.rc = r; this.rcNote = ''; this.rcAccept = false; this.reopenReason = '';
            this.rcReasons = {};
            r.channels.forEach((c: any) => { this.rcReasons[c.key] = { code: '', note: '' }; });
        }, (e: any) => { this.rc = null; this.error = this.msg(e, 'Could not load the month.'); });
        this.service.signed(this.rcAccount).subscribe((s: any[]) => this.signed = s);
    }

    get needsReason(): boolean { return !!this.rc && this.rc.channels.some((c: any) => !c.within); }
    get unexplainedOver(): boolean { return !!this.rc && this.rc.counts.unexplainedAmount > this.rc.tolerance; }

    sign() {
        this.error = ''; this.message = '';
        this.service.signoff({ account: this.rcAccount, month: this.rcMonth, note: this.rcNote, reasons: this.rcReasons, acceptUnexplained: this.rcAccept }).subscribe(() => {
            this.message = 'The month is signed.'; this.loadMonth();
        }, (e: any) => this.error = this.msg(e, 'Could not sign the month.'));
    }

    reopen() {
        this.service.reopen({ account: this.rcAccount, month: this.rcMonth, reason: this.reopenReason }).subscribe(() => { this.message = 'The month is open again.'; this.loadMonth(); }, (e: any) => this.error = this.msg(e, 'Could not open the month.'));
    }

    showUnexplained() {
        this.lf = { account: this.rcAccount, from: this.rcMonth + '-01', to: iso(new Date(+this.rcMonth.slice(0, 4), +this.rcMonth.slice(5, 7), 0)), status: 'UNEXPLAINED', direction: '', q: '' };
        this.setTab('lines');
    }

    // ------------------------------------------------------------------ accounts and import
    loadAccounts() {
        this.service.accounts().subscribe((r: any) => { this.accounts = r.accounts; this.stores = r.stores; this.tolerance = r.tolerance; }, (e: any) => this.error = this.msg(e, 'Could not load the accounts.'));
    }
    addAccount() { this.acc = { id: null, name: '', bank_name: '', last4: '', store_id: null, opening_balance: null, opening_date: '', active: true }; }
    editAccount(a: any) { this.acc = { ...a }; }
    saveAccount() {
        this.error = '';
        this.service.saveAccount(this.acc.id, this.acc).subscribe(() => { this.message = 'Account saved.'; this.acc = null; this.loadAccounts(); }, (e: any) => this.error = this.msg(e, 'Could not save the account.'));
    }

    loadRules() { this.service.rules().subscribe((r) => this.rules = r); }
    removeRule(id: number) { this.service.removeRule(id).subscribe(() => this.loadRules()); }
    loadImports() { if (this.impAccount) this.service.imports(this.impAccount).subscribe((r) => this.imports = r); }

    pick(ev: any) {
        this.impFile = ev.target.files && ev.target.files[0] ? ev.target.files[0] : null;
        this.pv = null; this.mapping = null; this.result = null; this.message = ''; this.error = '';
    }

    readFile() {
        if (!this.impAccount || !this.impFile) return;
        this.error = ''; this.result = null;
        this.service.preview(this.impAccount, this.impFile, this.mapping || undefined).subscribe((r: any) => {
            this.pv = r;
            if (r.mapping && !this.mapping) this.mapping = { headerRow: r.mapping.headerRow, delimiter: r.mapping.delimiter, columns: [...r.mapping.columns], dateFormat: r.mapping.dateFormat };
        }, (e: any) => this.error = this.msg(e, 'Could not read the file.'));
    }

    setRole(i: number, role: string) { this.mapping.columns[i] = role; }

    doImport() {
        if (!this.impAccount || !this.impFile) return;
        this.importing = true; this.error = '';
        this.service.importFile(this.impAccount, this.impFile, this.pv && this.pv.recognised ? undefined : this.mapping || undefined).subscribe((r: any) => {
            this.importing = false; this.result = r; this.pv = null; this.impFile = null; this.loadAccounts(); this.loadImports();
        }, (e: any) => { this.importing = false; this.error = this.msg(e, 'Could not import the file.'); });
    }

    // ------------------------------------------------------------------ records
    drugRegister: any = null;
    get drugRegisterOn(): boolean { return this.auth.moduleOn('drug_register'); }
    loadRecords() {
        this.service.records().subscribe((r: any) => {
            this.rec = r;
            // pharmacy pack: where the online drug register is on, its coverage stands in for the paper register's monthly check
            if (r.pharmacy && this.drugRegisterOn) this.service.drugCoverage().subscribe((c: any) => this.drugRegister = c, () => this.drugRegister = null);
        }, (e: any) => this.error = this.msg(e, 'Could not load the records check.'));
    }
    attest(month: string) {
        this.service.attest({ period: month }).subscribe(() => { this.message = 'Marked as checked.'; this.loadRecords(); }, (e: any) => this.error = this.msg(e, 'Could not save.'));
    }
}
