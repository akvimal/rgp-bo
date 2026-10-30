import { Component, OnInit } from "@angular/core";
import { ProductsService } from "../products.service";

/**
 * The price policy: prices that are out of policy (above the legal ceiling, below the class floor markup, deeper than the class
 * discount cap), the next step for each, and who may apply it. Raises are stepped so customers never see a sudden rise. The Business
 * Head also edits the class table and can accept an exception.
 */
@Component({
    templateUrl: './pricing-policy.component.html'
})
export class PricingPolicyComponent implements OnInit {

    data: any = null;
    loading = true;
    error = '';
    message = '';
    busy = false;
    filter = 'all';

    performance: any = null;
    impact: any = null;
    exceptionFor: any = null;
    exception = { reason: '', until: '' };

    readonly classNames: { [k: string]: string } = {
        LOW: 'Low trade margin (under 30%)', MID: 'Medium trade margin (30 to 70%)', HIGH: 'High trade margin (70% and over)',
    };
    readonly abcNames: { [k: string]: string } = { A: 'A: first 70% of profit', B: 'B: next 20%', C: 'C: the rest' };
    readonly why: { [k: string]: string } = {
        OVER_MRP: 'Above the legal ceiling (MRP less GST)', BELOW_FLOOR: 'Markup below the class floor', OVER_CAP: 'Discount deeper than the class cap',
    };

    constructor(private service: ProductsService) {}

    ngOnInit() { this.load(); this.service.pricingMode().subscribe((r: any) => this.mode = r?.settings || null, () => this.mode = null); }

    /** how the business prices, for the line at the top of the page */
    mode: any = null;
    get modeText(): string {
        if (!this.mode) return '';
        return this.mode.mode === 'MRP' ? 'You sell at the MRP: every price should be the MRP.'
            : this.mode.mode === 'DISCOUNT' ? `You sell at a discount off the MRP: usually ${this.mode.discountPct}%, never deeper than ${this.mode.maxDiscountPct}%.`
            : 'You price with smart groups: each product follows the rules of its group.';
    }
    get readyRaises(): number { return (this.data?.items || []).filter((i: any) => i.action === 'RAISE' && i.canapply).length; }

    applyRaises() {
        this.busy = true; this.message = ''; this.error = '';
        this.service.pricingApplyRaises().subscribe((r: any) => {
            this.busy = false;
            this.message = `${r.applied} price${r.applied === 1 ? '' : 's'} brought to the rule${r.failed?.length ? '; ' + r.failed.length + ' could not be changed' : ''}.`;
            this.load();
        }, (err: any) => { this.busy = false; this.error = this.msg(err, 'Could not apply the prices.'); });
    }

    load() {
        this.loading = true;
        this.service.pricingReview().subscribe((d: any) => {
            this.data = d; this.loading = false; this.refilter();
            this.service.pricingPerformance().subscribe((p: any) => this.performance = p, () => this.performance = null);
            this.service.pricingImpact().subscribe((p: any) => this.impact = p, () => this.impact = null);
        }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the pricing policy.'); });
    }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    /** the table is given a list that changes only when the filter or the data does, so its sorting and page survive a refresh */
    shown: any[] = [];

    /** a chip toggles its filter; the drop-down sets it directly */
    setFilter(value: string, direct = false) {
        this.filter = direct ? value : (this.filter === value ? 'all' : value);
        this.refilter();
    }

    private refilter() {
        const all = this.data?.items || [];
        if (this.filter === 'cuts') this.shown = all.filter((i: any) => i.action === 'CUT');
        else if (this.filter === 'raises') this.shown = all.filter((i: any) => i.action === 'RAISE');
        else if (this.filter === 'ready') this.shown = all.filter((i: any) => i.canapply);
        else this.shown = all;
    }

    get isBusinessHead(): boolean { return this.data?.level === 'BUSINESS'; }
    get readyCuts(): number { return (this.data?.items || []).filter((i: any) => i.action === 'CUT' && i.canapply).length; }

    /** an A/B/C or band label for the performance table */
    ratio(r: number | null): string { return r === null || r === undefined ? '-' : (r >= 1 ? '+' : '') + Math.round((r - 1) * 100) + '%'; }

    problems(i: any): string { return (i.violations || []).map((v: string) => this.why[v] || v).join('; '); }

    classLabel(key: string): string {
        const [band, abc] = String(key).split('_');
        return `${this.classNames[band] || band}, ${this.abcNames[abc] || abc}`;
    }

    apply(i: any) {
        this.busy = true; this.message = ''; this.error = '';
        this.service.pricingApply(i.productid).subscribe((r: any) => {
            this.busy = false;
            this.message = `${r.title}: ${r.from} to ${r.to}${r.done ? '' : ' (next step later: target ' + r.target + ')'}`;
            this.load();
        }, (err: any) => { this.busy = false; this.error = this.msg(err, 'Could not apply the step.'); });
    }

    applyCuts() {
        this.busy = true; this.message = ''; this.error = '';
        this.service.pricingApplyCuts().subscribe((r: any) => {
            this.busy = false;
            this.message = `${r.applied} price${r.applied === 1 ? '' : 's'} brought down to the legal ceiling${r.failed?.length ? '; ' + r.failed.length + ' could not be changed' : ''}.`;
            this.load();
        }, (err: any) => { this.busy = false; this.error = this.msg(err, 'Could not apply the cuts.'); });
    }

    get readyNew(): number { return (this.data?.unpriced || []).filter((u: any) => u.canapply).length; }

    priceNew(u: any) {
        this.busy = true; this.message = ''; this.error = '';
        this.service.pricingPriceNew(u.productid).subscribe((r: any) => {
            this.busy = false;
            this.message = `${r.title}: first price ${r.price} (${r.discountpct}% off MRP, markup ${r.markuppct}%).`;
            this.load();
        }, (err: any) => { this.busy = false; this.error = this.msg(err, 'Could not set the price.'); });
    }

    priceAll() {
        this.busy = true; this.message = ''; this.error = '';
        this.service.pricingPriceNewAll().subscribe((r: any) => {
            this.busy = false;
            this.message = `${r.applied} product${r.applied === 1 ? '' : 's'} given the suggested price${r.failed?.length ? '; ' + r.failed.length + ' could not be priced' : ''}.`;
            this.load();
        }, (err: any) => { this.busy = false; this.error = this.msg(err, 'Could not set the prices.'); });
    }

    askException(i: any) { this.exceptionFor = i; this.exception = { reason: '', until: '' }; }

    saveException() {
        this.service.pricingAddException(this.exceptionFor.productid, this.exception.reason, this.exception.until).subscribe(() => {
            this.message = `Exception recorded for ${this.exceptionFor.title}.`; this.exceptionFor = null; this.load();
        }, (err: any) => this.error = this.msg(err, 'Could not record the exception.'));
    }
}
