import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";
import { VendorsService } from "../../vendors/vendors.service";

@Component({
    selector: 'app-purchase-suggestion',
    templateUrl: './purchase-suggestion.component.html'
})
export class PurchaseSuggestionComponent implements OnDestroy {
    suggestions:any[] = [];
    vendors:any[] = [];
    vendorid:string = '';
    days:number = 30;
    targetdays:number = 21;
    /** when nothing sold in `days`, this many days back are looked at, so a slow mover is still listed */
    slowdays:number = 90;
    /** scale by how the same stretch of the year went in the last two years */
    seasonal:boolean = true;
    storeid:number | null = null;
    /** open requests typed for a product that is not in the product list: Reorder works from products, so these wait to be linked */
    unlinked:any[] = [];
    private subs = new Subscription();
    expecteddate:string = '';
    comments:string = '';
    feedback:string = '';

    constructor(
        private requestService: PurchaseIntentService,
        private vendorService: VendorsService,
        private storeContext: StoreContextService
    ) {}

    /** the store being looked at is the one chosen at the top of the page */
    get storeName(): string {
        const s = this.storeContext.stores.find((x:any) => Number(x.id) === Number(this.storeid));
        return this.storeid && s ? (s.name || s.location || `Store ${this.storeid}`) : 'All stores';
    }

    ngOnDestroy(){ this.subs.unsubscribe(); }

    ngOnInit(){
        this.vendorService.findUsable().subscribe((data:any) => this.vendors = data || []);
        this.storeid = this.storeContext.selectedStoreId;
        this.subs.add(this.storeContext.selectedStoreId$.subscribe((id:any) => {
            if(id !== this.storeid){ this.storeid = id; this.fetchSuggestions(); }
        }));
        this.fetchSuggestions();
    }

    fetchSuggestions(){
        this.feedback = '';
        const params:any = {
            days: this.days,
            targetdays: this.targetdays,
            slowdays: this.slowdays,
            seasonal: this.seasonal
        };
        if(this.storeid){
            params.storeid = this.storeid;
        }
        if(this.vendorid){
            params.vendorid = this.vendorid;
        }
        this.requestService.findAll().subscribe((rows:any) => {
            this.unlinked = (rows || []).filter((r:any) => !r.product && !r.productid && ['Open', 'Reviewed'].includes(r.status));
        }, () => { this.unlinked = []; });
        this.requestService.findSuggestions(params).subscribe((data:any) => {
            this.suggestions = (data || []).map((item:any) => ({ ...item, selected: false }));
        });
    }

    selectedCount(){
        return this.suggestions.filter((item:any) => item.selected && item.final_qty > 0).length;
    }

    createOrders(){
        const items = this.suggestions
            .filter((item:any) => item.selected && item.final_qty > 0 && item.vendor_id)
            .map((item:any) => ({
                productid: item.product_id,
                vendorid: item.vendor_id,
                finalqty: +item.final_qty,
                trendqty: +item.trend_qty,
                adhocqty: +item.adhoc_qty,
                requestids: item.request_ids || [],
                reasonsummary: item.reason_summary
            }));

        if(items.length === 0){
            this.feedback = 'Select at least one suggestion with a vendor and a positive final quantity.';
            return;
        }

        this.requestService.createOrdersFromSuggestions({
            expecteddate: this.expecteddate || null,
            comments: this.comments || null,
            items
        }).subscribe((result:any) => {
            const ids = (result.orders || []).map((order:any) => `#${order.id}`).join(', ');
            this.feedback = `Created ${result.created} order(s) ${ids}`;
            this.fetchSuggestions();
        });
    }
}
