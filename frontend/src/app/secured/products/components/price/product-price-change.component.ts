import { Component, EventEmitter, Input, OnDestroy, Output, SimpleChanges } from "@angular/core";
import { DateUtilService } from "src/app/secured/date-util.service";
import { ProductsService } from "../../products.service";
import { priceBeforeGst, priceWithGst } from "../../price-basis";

const MARGIN_WARN = 300;     // above this the price is saved with a warning
const MARGIN_LIMIT = 1000;   // above this it is refused as a typing mistake

/** why a price changed, as shown to people; the stored values are the keys */
export const PRICE_REASONS: { value: string; label: string; needsComment?: boolean }[] = [
    { value: 'Initial', label: 'Initial price' },
    { value: 'Higher PTR', label: 'Cost rise' },
    { value: 'MRP change', label: 'MRP change' },
    { value: 'Market', label: 'Market', needsComment: true },
    { value: 'Correction', label: 'Correction', needsComment: true },
    { value: 'Other', label: 'Other', needsComment: true },
];
const REASON_LABELS: { [k: string]: string } = PRICE_REASONS.reduce((m: { [k: string]: string }, r) => { m[r.value] = r.label; return m; }, { Purchase: 'At purchase', Policy: 'Pricing policy' });

/**
 * The Set the price dialog: a product's current price and cost, the limits its class allows (the lowest price and the legal ceiling), a price
 * to type with live feedback on the pricing policy (does it need an approver, how big may a raise be), and the history of its prices.
 */
@Component({
    selector: 'app-product-price-change',
    templateUrl: 'product-price-change.component.html'
})
export class ProductPriceChangeComponent implements OnDestroy {

    @Input() productid;
    @Output() added = new EventEmitter();
    @Output() cancelled = new EventEmitter();

    readonly reasons = PRICE_REASONS;
    price:any = { sale: '', date: '', reason: '', comments: '' };
    current:any = {};
    /** the class, the limits and a suggested price for this product (from the pricing policy); null until it arrives or when never purchased */
    policy:any = null;
    /** what the policy says about the price typed: what it breaks, who must approve, whether this user may */
    check:any = null;
    saving = false;
    /** prices are shown and typed with GST included (what the customer pays) or before GST: stored prices are always before GST */
    basis: 'incl' | 'excl' = 'excl';
    error = '';
    /** the price breaks the pricing policy and this user may approve it: a reason is asked for */
    needsOverride = false;
    private timer:any = null;

    constructor(private service:ProductsService, private dateService:DateUtilService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.productid && changes.productid.currentValue > 0){
            this.error = '';
            this.policy = null;
            this.check = null;
            this.needsOverride = false;
            const id = changes.productid.currentValue;
            this.service.pricingMode().subscribe((m:any) => this.basis = m?.settings?.basis === 'incl' ? 'incl' : 'excl', () => this.basis = 'excl');
            this.service.findPricesById(id).subscribe((data:any) => {
                this.current = data || {};
                const ex = data?.price?.price ?? '';
                this.price = { sale: ex === '' ? '' : this.show(+ex), date: this.defaultDate(), reason: '', comments: '' };
            });
            this.service.pricingProductCheck(id).subscribe((p:any) => this.policy = p?.known ? p : null, () => this.policy = null);
        }
    }

    ngOnInit(){
        this.price.date = this.defaultDate();
    }

    ngOnDestroy(){ clearTimeout(this.timer); }

    // ------------------------------------------------------------------ dates: a new price starts after the day of the last change
    /** the date of the latest price row, which a new price cannot start on or before */
    get lastEffective(): string | null {
        const d = this.current?.history?.[0]?.eff_date;
        return d ? String(d).slice(0, 10) : null;
    }
    get minDate(): string | null {
        const last = this.lastEffective;
        if(!last) return null;
        const d = new Date(last + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
    }
    private defaultDate(): string {
        const today = this.dateService.getFormatDate(new Date());
        const min = this.minDate;
        return min && min > today ? min : today;
    }

    // ------------------------------------------------------------------ the figures
    /** the purchase cost and MRP the price is checked against (none until the product has been bought) */
    get ptr(): number { return +(this.current?.price?.ptr || 0); }
    get mrp(): number { return +(this.current?.price?.mrp || 0); }
    /** the GST the till bills (at most 5% since GST 2.0), and the GST the purchase batch carries (its cost includes that) */
    get saleTax(): number { return +(this.current?.price?.sale_tax ?? this.current?.price?.tax ?? 0); }
    get batchTax(): number { return +(this.current?.price?.tax || 0); }
    /** the price is without GST and the bill adds GST, so the most it can be is the MRP less the GST billed */
    get ceiling(): number { return this.mrp ? Math.floor(this.mrp / (1 + this.saleTax / 100) * 100 + 1e-6) / 100 : 0; }
    /** a stored price (before GST) as shown: with GST when the business prices that way */
    show(ex:number): number { return this.basis === 'incl' ? priceWithGst(ex, this.saleTax, this.mrp) : ex; }
    /** what is typed, as the price before GST that is stored and checked */
    get typed(): number {
        const shown = +this.price.sale || 0;
        return this.basis === 'incl' && shown > 0 ? priceBeforeGst(shown, this.saleTax, this.mrp) : shown;
    }
    /** with GST included, a price above the MRP is capped at the MRP */
    get overMrp(): boolean { return this.basis === 'incl' && this.mrp > 0 && (+this.price.sale || 0) > this.mrp + 0.005; }
    get cappedAt(): number | null { return this.ceiling && this.typed > this.ceiling ? this.ceiling : null; }
    get effective(): number { return this.cappedAt ?? this.typed; }
    /** markup and discount compare like with like: the price with GST against the cost and the MRP, both with GST */
    get withGst(): number { return this.effective * (1 + this.saleTax / 100); }
    get margin(): number | null { return this.ptr && this.typed > 0 ? Math.round((this.effective * (1 + this.batchTax / 100) - this.ptr) / this.ptr * 100) : null; }
    get discount(): number | null { return this.mrp && this.typed > 0 ? Math.round((this.mrp - this.withGst) / this.mrp * 100) : null; }
    get tooHigh(): boolean { return this.margin !== null && this.margin > MARGIN_LIMIT; }
    get high(): boolean { return this.margin !== null && this.margin > MARGIN_WARN && !this.tooHigh; }
    get belowCost(): boolean { return this.ptr > 0 && this.typed > 0 && this.effective * (1 + this.batchTax / 100) < this.ptr; }

    // ------------------------------------------------------------------ the pricing policy, live
    onPriceInput(value:any){
        this.price.sale = value;
        this.check = null;
        this.needsOverride = false;
        clearTimeout(this.timer);
        if(!(this.typed > 0) || !this.policy) return;
        this.timer = setTimeout(() => {
            this.service.pricingProductCheck(this.productid, this.typed).subscribe((r:any) => {
                this.check = r?.check || null;
                this.needsOverride = !!(this.check?.violations?.length && this.check.canapprove);
            }, () => this.check = null);
        }, 400);
    }

    useSuggestion(){
        if(this.policy?.suggestion) this.onPriceInput(this.show(this.policy.suggestion.price));
    }

    /** the typed price breaks the policy and this user may not approve it */
    get blocked(): boolean { return !!(this.check?.violations?.length && !this.check.canapprove); }
    get approver(): string { return this.check?.level === 'BUSINESS' ? 'a Business Head' : 'a Store Head or Business Head'; }

    // ------------------------------------------------------------------ reasons and what is missing
    reasonLabel(code:string): string { return REASON_LABELS[code] || code || ''; }
    get commentRequired(): boolean { return !!PRICE_REASONS.find(r => r.value === this.price.reason)?.needsComment; }

    get missing(): string[] {
        const out: string[] = [];
        if(!(this.typed > 0)) out.push('sale price');
        if(!this.price.date) out.push('effective date');
        if(!this.price.reason) out.push('reason');
        if(this.commentRequired && !String(this.price.comments || '').trim()) out.push('a comment (needed for this reason)');
        if(this.needsOverride && String(this.price.overridereason || '').trim().length < 5) out.push('the reason for setting this price anyway');
        return out;
    }

    isValid(){
        return this.missing.length === 0 && !this.tooHigh && !this.blocked && !this.saving;
    }

    onSave(){
        this.error = '';
        this.saving = true;
        this.service.addPrice({id:this.productid, ...this.price, sale: this.typed}).subscribe((data:any) => {
            this.saving = false;
            this.added.emit(data);
        }, err => {
            this.saving = false;
            const m = err?.error?.message;
            this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not save the price.');
            this.needsOverride = err?.status === 400 && /overridereason/.test(this.error);
        });
    }
}
