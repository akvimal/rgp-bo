import { Component, OnInit } from "@angular/core";
import { ProductsService } from "../products.service";

/**
 * Pricing rules: the limits of each product class (the lowest markup and the deepest discount) and the rules for how prices change,
 * who approves, how vendor rate rises are handled and whether billing above the MRP is refused. The Business Head changes them;
 * everyone else who may see cost can read them.
 */
@Component({
    templateUrl: './pricing-rules.component.html'
})
export class PricingRulesComponent implements OnInit {

    loading = true;
    error = '';
    message = '';
    saving = false;
    canedit = false;

    classes: any[] = [];

    // how the business prices: the mode, the GST basis, the numbers for a discount, and a worked example
    modeForm: any = { mode: 'SMART', basis: 'excl', discountPct: 10, maxDiscountPct: 15, minMarginPct: 0 };
    private modeOriginal = '';
    example = { mrp: 100, cost: 70, tax: 5 };
    preview: any = null;
    savingMode = false;
    modeMessage = '';
    private previewTimer: any = null;
    rules: any[] = [];
    form: { [key: string]: string } = {};
    private original: { [key: string]: string } = {};

    readonly groups = [
        { key: 'steps', title: 'How a price is raised', intro: 'A price is raised in steps so customers never see a sudden jump. A price cut is never held.' },
        { key: 'approval', title: 'Who approves a price change', intro: 'A change that breaks the class limits or the step rule needs an approver and a reason.' },
        { key: 'purchase', title: 'Vendor rate rises at receiving', intro: 'When an invoice line costs more than the last rate from that vendor.' },
        { key: 'billing', title: 'Billing', intro: 'What the till and the server do about the MRP.' },
    ];
    readonly bands: { [k: string]: string } = { LOW: 'Low trade margin (cost under 30% below MRP)', MID: 'Medium trade margin (30 to 70% below MRP)', HIGH: 'High trade margin (70% or more below MRP)' };
    readonly ranks: { [k: string]: string } = { A: 'A: the first 70% of profit', B: 'B: the next 20%', C: 'C: the rest' };

    constructor(private service: ProductsService) {}

    ngOnInit() { this.load(); this.loadMode(); }

    loadMode() {
        this.service.pricingMode().subscribe((r: any) => {
            this.modeForm = { ...r.settings };
            this.modeOriginal = JSON.stringify(this.modeForm);
            this.refreshPreview();
        }, () => { /* without cost access the card is simply not filled */ });
    }

    // a read-only look at the prices already in place, and which way of pricing fits them
    check: any = null;
    checking = false;
    checkMessage = '';

    runCheck() {
        this.checking = true; this.error = ''; this.checkMessage = '';
        this.service.pricingCheck().subscribe((r: any) => { this.check = r; this.checking = false; }, (err: any) => { this.checking = false; this.error = this.msg(err, 'Could not look at the prices.'); });
    }

    /** fills the choice above with what fits the prices; nothing is saved until "Save how I price" */
    useRecommendation() {
        const r = this.check?.recommendation;
        if (!r || !this.canedit) return;
        this.modeForm.mode = r.mode;
        if (r.mode === 'DISCOUNT') { this.modeForm.discountPct = r.discountPct; this.modeForm.maxDiscountPct = r.maxDiscountPct; }
        this.checkMessage = 'Filled in above. Read it, then press "Save how I price".';
        this.refreshPreview();
    }

    maxBand(): number { return Math.max(1, ...((this.check?.bands || []).map((b: any) => b.count))); }
    modeName(m: string): string { return m === 'MRP' ? 'At the MRP' : m === 'DISCOUNT' ? 'A discount off the MRP' : 'Smart groups'; }

    get modeChanged(): boolean { return JSON.stringify(this.modeForm) !== this.modeOriginal; }

    pickMode(m: string) {
        if (!this.canedit) return;
        this.modeForm.mode = m;
        this.refreshPreview();
    }

    /** a worked example of what the settings do to a product: asked of the server so the screen and the till never disagree */
    refreshPreview() {
        clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => {
            if (this.modeForm.mode === 'SMART') { this.preview = null; return; }
            this.service.pricingPreviewMode({ ...this.modeForm, ...this.example }).subscribe((r: any) => this.preview = r.preview, (err: any) => { this.preview = null; this.error = this.msg(err, ''); });
        }, 250);
    }

    saveMode() {
        this.error = ''; this.modeMessage = ''; this.savingMode = true;
        this.service.pricingSaveMode(this.modeForm).subscribe((r: any) => {
            this.savingMode = false;
            this.modeForm = { ...r.settings };
            this.modeOriginal = JSON.stringify(this.modeForm);
            this.modeMessage = 'Saved. Prices are now judged by this setting everywhere.';
            this.load();
        }, (err: any) => { this.savingMode = false; this.error = this.msg(err, 'Could not save how you price.'); });
    }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    load() {
        this.loading = true;
        this.service.pricingRules().subscribe((r: any) => {
            this.canedit = !!r.canedit;
            this.rules = r.rules || [];
            this.form = {}; this.original = {};
            this.rules.forEach((x: any) => { this.form[x.key] = x.value; this.original[x.key] = x.value; });
            this.service.pricingPolicy().subscribe((p: any) => {
                this.counts = p.counts || {};
                this.classes = (p.classes || []).map((c: any) => ({ ...c, floor: c.floor_markup_pct, cap: c.max_discount_pct, usual: c.usual_discount_pct, f0: c.floor_markup_pct, c0: c.max_discount_pct, u0: c.usual_discount_pct }));
                this.loading = false;
            }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the class limits.'); });
        }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the pricing rules.'); });
    }

    inGroup(key: string): any[] { return this.rules.filter((r) => r.group === key); }

    classLabel(key: string): string {
        const [band, rank] = String(key).split('_');
        return `${this.bands[band] || band}, ${this.ranks[rank] || rank}`;
    }

    /** the groups as the owner thinks of them: how much the product earns, and how wide its margin is */
    readonly gridRows = [
        { band: 'HIGH', name: 'Wide margin', help: 'cost is 70% or more below the MRP' },
        { band: 'MID', name: 'Medium margin', help: 'cost is 30 to 70% below the MRP' },
        { band: 'LOW', name: 'Thin margin', help: 'cost is under 30% below the MRP' },
    ];
    readonly gridCols = [
        { abc: 'A', name: 'Top earners', help: 'the products that make the first 70% of your profit' },
        { abc: 'B', name: 'Steady earners', help: 'the next 20% of profit' },
        { abc: 'C', name: 'Small earners', help: 'the last 10% of profit' },
    ];
    /** a typical trade margin for each band, to work out the example product */
    private readonly typicalMargin: { [band: string]: number } = { LOW: 0.2, MID: 0.5, HIGH: 0.8 };
    counts: { [key: string]: number } = {};
    picked = '';

    groupName(key: string): string {
        const [band, abc] = String(key).split('_');
        const r = this.gridRows.find((x) => x.band === band), c = this.gridCols.find((x) => x.abc === abc);
        return `${c ? c.name : abc}, ${r ? r.name.toLowerCase() : band}`;
    }
    classOf(band: string, abc: string): any { return this.classes.find((c) => c.class_key === `${band}_${abc}`); }
    countOf(key: string): number { return this.counts[key] || 0; }
    get pickedClass(): any { return this.classes.find((c) => c.class_key === this.picked); }
    /** the usual discount can never be deeper than the most allowed, so lowering the limit brings it down too */
    capChanged(c: any) { if (+c.usual > +c.cap) c.usual = +c.cap; }
    pick(key: string) { this.picked = this.picked === key ? '' : key; }

    /** what the group's limits mean on a typical product (MRP 100, GST 5%): the lowest price a customer may be charged */
    groupExample(c: any): { cost: number; lowest: number; offPct: number; byFloor: boolean } {
        const [band] = String(c.class_key).split('_');
        const mrp = 100, tax = 5;
        const cost = Math.round(mrp * (1 - (this.typicalMargin[band] ?? 0.2)) * 100) / 100;
        const floorP = Math.ceil(cost / (1 + tax / 100) * (1 + (+c.floor || 0) / 100) * 100 - 1e-6) / 100;
        const capP = (+c.cap || 0) <= 0 ? Math.floor(mrp / (1 + tax / 100) * 100 + 1e-6) / 100 : Math.ceil(mrp * (1 - +c.cap / 100) / (1 + tax / 100) * 100 - 1e-6) / 100;
        const lowestEx = Math.max(floorP, capP);
        const lowest = Math.min(mrp, Math.round(lowestEx * (1 + tax / 100) * 100) / 100);
        return { cost, lowest, offPct: Math.round((1 - lowest / mrp) * 1000) / 10, byFloor: floorP > capP };
    }
    /** the one number a cell shows: how far below the MRP this group may be sold */
    headline(c: any): string {
        if (!c) return '';
        const e = this.groupExample(c);
        return e.offPct <= 0 ? 'only at the MRP' : `down to ${e.offPct}% off MRP`;
    }

    get changedRules(): string[] { return Object.keys(this.form).filter((k) => String(this.form[k]) !== String(this.original[k])); }
    classChanged(c: any): boolean { return +c.floor !== +c.f0 || +c.cap !== +c.c0 || +c.usual !== +c.u0; }

    saveRules() {
        this.error = ''; this.message = ''; this.saving = true;
        const values: { [key: string]: string } = {};
        this.changedRules.forEach((k) => values[k] = this.form[k]);
        this.service.pricingSaveRules(values).subscribe((r: any) => {
            this.saving = false;
            this.message = `Saved ${r.changed.length} rule${r.changed.length === 1 ? '' : 's'}.`;
            this.rules = r.rules; this.form = {}; this.original = {};
            this.rules.forEach((x: any) => { this.form[x.key] = x.value; this.original[x.key] = x.value; });
        }, (err: any) => { this.saving = false; this.error = this.msg(err, 'Could not save the rules.'); });
    }

    saveClass(c: any) {
        this.error = ''; this.message = '';
        this.service.pricingSavePolicy(c.class_key, +c.floor, +c.cap, +c.usual).subscribe(() => {
            c.f0 = +c.floor; c.c0 = +c.cap; c.u0 = +c.usual;
            this.message = `Saved the limits for ${this.groupName(c.class_key)}.`;
        }, (err: any) => this.error = this.msg(err, 'Could not save the class.'));
    }
}
