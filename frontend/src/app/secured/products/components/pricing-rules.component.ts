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
            this.message = `Saved the limits for ${c.class_key}.`;
        }, (err: any) => this.error = this.msg(err, 'Could not save the class.'));
    }
}
