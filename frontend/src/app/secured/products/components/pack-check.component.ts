import { Component, OnInit } from "@angular/core";
import { ProductsService } from "../products.service";
import { ConfirmService } from "src/app/shared/confirm.service";

type Tab = 'OPEN' | 'FIXED' | 'DISMISSED';

/**
 * Products whose pack size or unit looks wrong. A wrong pack makes the cost per unit wrong, so margins, rate checks and
 * "sold below cost" figures are wrong too. A row is settled here: look at the recent purchases and the stock, then either
 * say the pack is correct (with the reason) or change it (after seeing what it does to the stock). Opening the product is
 * for anything else. Settled products move to the Fixed and Dismissed tabs, and come back only if a later purchase or price
 * shows a new problem.
 */
@Component({
    templateUrl: './pack-check.component.html'
})
export class PackCheckComponent implements OnInit {

    all: any[] = [];
    rows: any[] = [];                // the rows of the chosen tab, kept as one array so the table's paging stays put
    counts: { [t in Tab]: number } = { OPEN: 0, FIXED: 0, DISMISSED: 0 };
    tab: Tab = 'OPEN';
    loading = true;
    error = '';
    message = '';
    done: any = null;                // the product just changed, with links to what to do next

    open: number | null = null;      // the row being settled
    ev: any = null;
    evLoading = false;
    panelError = '';
    busy = false;

    dismissReason = '';
    dismissNote = '';
    fixPack: number | null = null;
    fixReason = '';
    fixNote = '';
    impact: any = null;
    private impactTimer: any = null;

    readonly tabs: { key: Tab, label: string }[] = [
        { key: 'OPEN', label: 'Open' }, { key: 'FIXED', label: 'Fixed' }, { key: 'DISMISSED', label: 'Left as it is' },
    ];

    /** the reasons as the screen words them (the list carries only the code) */
    readonly reasonLabel: { [code: string]: string } = {
        PACK_WRONG: 'The pack size was entered wrongly', PACKING_CHANGED: 'The maker changed the pack', OTHER: 'Other',
        MAKER_CHANGED_PACK: 'The maker changed the pack', SOLD_LOOSE_AND_FULL: 'Sold loose and in full packs', ONE_OFF: 'A one-off purchase, nothing to correct',
    };

    readonly why: { [code: string]: string } = {
        UNIT_JUMP: 'MRP changed by a large factor between two purchases (a box one time, single pieces the next)',
        COST_OVER_MRP: 'The latest purchase rate with GST is above its MRP',
        PRICE_OVER_MRP: 'The sale price with GST is above the MRP',
        PRICE_FAR_BELOW_MRP: 'The sale price is under 5% of the MRP',
    };

    constructor(private service: ProductsService, private confirm: ConfirmService) {}

    ngOnInit() { this.load(); }

    load() {
        this.service.packCheck().subscribe(
            (r: any[]) => { this.all = r || []; this.loading = false; this.refilter(); },
            (err: any) => { this.loading = false; this.error = err?.error?.message || 'Could not load the pack check.'; });
    }

    private refilter() {
        this.counts = { OPEN: 0, FIXED: 0, DISMISSED: 0 };
        for (const r of this.all) { const t = r.status as Tab; if (this.counts[t] !== undefined) { this.counts[t]++; } }
        this.rows = this.all.filter(r => r.status === this.tab);
    }

    setTab(t: Tab) { this.tab = t; this.closePanel(); this.refilter(); }

    private closePanel() { this.open = null; this.ev = null; this.panelError = ''; this.impact = null; }

    /** opens the row's panel: recent purchases, stock and sales, and the two ways to settle it */
    review(r: any) {
        if (this.open === r.id) { this.closePanel(); return; }
        this.closePanel();
        this.open = r.id;
        this.evLoading = true;
        this.dismissReason = ''; this.dismissNote = ''; this.fixPack = null; this.fixReason = ''; this.fixNote = '';
        this.service.packEvidence(r.id).subscribe(
            (e: any) => { this.ev = e; this.evLoading = false; },
            (err: any) => { this.evLoading = false; this.panelError = err?.error?.message || 'Could not load the details.'; });
    }

    /** MRP ratio between a purchase and the one before it, when it is big enough to matter (to mark the jump in the list) */
    jumpAt(i: number): number | null {
        const p = this.ev?.purchases || [];
        if (i + 1 >= p.length || !(p[i].mrp > 0) || !(p[i + 1].mrp > 0)) { return null; }
        const r = p[i].mrp / p[i + 1].mrp;
        return (r >= 2.5 || r <= 0.4) ? Math.round(r * 100) / 100 : null;
    }

    quickPack(n: number) { this.fixPack = n; this.packChanged(); }

    /** shows what the new pack does to the stock, a moment after the number stops changing */
    packChanged() {
        clearTimeout(this.impactTimer);
        this.impact = null; this.panelError = '';
        const n = Number(this.fixPack);
        if (!Number.isInteger(n) || n < 1 || n === this.ev?.product?.pack) { return; }
        this.impactTimer = setTimeout(() => {
            this.service.packImpact(this.ev.product.id, n).subscribe(
                (i: any) => this.impact = i,
                (err: any) => this.panelError = err?.error?.message || 'Could not work out the effect.');
        }, 300);
    }

    get canFix(): boolean {
        return !!this.impact && this.impact.belowZero === 0 && !!this.fixReason && (this.fixReason !== 'OTHER' || this.fixNote.trim().length >= 3) && !this.busy;
    }

    get canDismiss(): boolean {
        return !!this.dismissReason && (this.dismissReason !== 'OTHER' || this.dismissNote.trim().length >= 3) && !this.busy;
    }

    dismiss(r: any) {
        this.busy = true; this.panelError = '';
        this.service.packDismiss(r.id, { reason: this.dismissReason, note: this.dismissNote }).subscribe(() => {
            this.busy = false; this.closePanel();
            this.message = `${r.title} is left as it is.`; this.done = null;
            this.load();
        }, (err: any) => { this.busy = false; this.panelError = err?.error?.message || 'Could not save.'; });
    }

    /** the change restates every batch of the product, so it is confirmed with the effect in front of the person */
    fix(r: any) {
        const i = this.impact;
        this.confirm.confirmAction('Change the pack?', [
            `${r.title}: pack from ${i.oldPack} to ${i.newPack}.`,
            `Units in stock: ${i.unitsBefore} before, ${i.unitsAfter} after (${i.batches} batch${i.batches === 1 ? '' : 'es'} restated).`,
            `Cost of a unit changes to match the new pack.`,
            'This is recorded with your name and the reason.',
        ], 'Change the pack', () => {
            this.busy = true; this.panelError = '';
            this.service.packFix(r.id, { pack: i.newPack, expectedPack: i.oldPack, reason: this.fixReason, note: this.fixNote, confirm: true }).subscribe(() => {
                this.busy = false; this.closePanel();
                this.message = ''; this.done = { id: r.id, title: r.title, from: i.oldPack, to: i.newPack };
                this.load();
            }, (err: any) => { this.busy = false; this.panelError = err?.error?.message || 'Could not change the pack.'; });
        });
    }
}
