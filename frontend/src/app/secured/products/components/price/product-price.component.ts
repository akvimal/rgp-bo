import { Component, OnInit } from "@angular/core";
import { ProductsService } from "../../products.service";
import { priceWithGst } from "../../price-basis";

/**
 * The price list: every purchased product with its current price, markup and discount, and where it stands against the pricing policy
 * (the same statuses as Pricing policy, taken from it, so the two pages never disagree). The pencil sets a price.
 */
@Component({
    templateUrl: 'product-price.component.html'
})
export class ProductPriceComponent implements OnInit {

    criteria = {active:true,title:''}
    productid=0;

    products:any[] = [];
    shown:any[] = [];
    statusFilter = '';
    message = '';
    error = '';
    loading = false;
    showPriceChange:boolean = false;

    // product id -> ceiling | floor | cap | check | none, from the pricing policy
    private statuses = new Map<number, string>();

    constructor(private service:ProductsService){}

    /** prices shown with GST included (what the customer pays) when the business prices that way */
    basis: 'incl' | 'excl' = 'excl';
    shownPrice(p:any): number { return this.basis === 'incl' ? priceWithGst(+p.price, +(p.sale_tax ?? p.tax ?? 0), +p.mrp) : +p.price; }

    ngOnInit(){
        this.service.pricingMode().subscribe((m:any) => this.basis = m?.settings?.basis === 'incl' ? 'incl' : 'excl', () => this.basis = 'excl');
        this.filter();
        this.loadStatuses();
    }

    filter(){
        this.loading = true;
        this.error = '';
        this.service.findAllPrices(this.criteria).subscribe((data:any) => {
            this.products = data || [];
            this.loading = false;
            this.refilter();
        }, () => { this.loading = false; this.error = 'Could not load the prices.'; });
    }

    /** where each product stands against the pricing policy; without cost access the column is simply empty */
    loadStatuses(){
        this.service.pricingReview().subscribe((r:any) => {
            const m = new Map<number, string>();
            (r.check || []).forEach((i:any) => m.set(+i.productid, 'check'));
            (r.items || []).forEach((i:any) => m.set(+i.productid, i.action === 'CUT' ? 'ceiling' : ((i.violations || []).includes('BELOW_FLOOR') ? 'floor' : 'cap')));
            (r.unpriced || []).forEach((u:any) => m.set(+u.productid, 'none'));
            this.statuses = m;
            this.refilter();
        }, () => { this.statuses = new Map(); this.refilter(); });
    }

    statusOf(p:any): string {
        if(!(+p.price > 0)) return 'none';
        return this.statuses.get(+p.id) || '';
    }

    setStatusFilter(value:string){
        this.statusFilter = value;
        this.refilter();
    }

    /** the table is given a list that only changes when the filter or the data does, so its sorting and page survive a refresh */
    private refilter(){
        const f = this.statusFilter;
        this.shown = !f ? this.products : this.products.filter(p => {
            const s = this.statusOf(p);
            return f === 'policy' ? (s === 'floor' || s === 'cap') : s === f;
        });
    }

    changePrice(productid:number){
        this.productid=productid;
        this.showPriceChange = true;
    }

    changed(event:any){
        this.showPriceChange = false;
        const notes: string[] = [];
        if (event?.capped) notes.push(`capped at ${event.ceiling} (the MRP ${event.mrp} less GST)`);
        for (const w of event?.warnings || []) notes.push(w);
        this.message = `Price saved at ${event?.saleprice ?? ''}${notes.length ? ': ' + notes.join(' ') : '.'}`;
        this.filter();
        this.loadStatuses();
    }
}
