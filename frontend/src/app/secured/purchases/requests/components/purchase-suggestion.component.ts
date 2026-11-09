import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { PurchaseOrderService } from "../purchase-order.service";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";
import { VendorsService } from "../../vendors/vendors.service";

@Component({
    selector: 'app-purchase-suggestion',
    templateUrl: './purchase-suggestion.component.html',
    styles: [`
      .reo-step { flex: 1 1 11rem; border: 1px solid var(--bs-border-color, #dee2e6); border-radius: .5rem; padding: .5rem .65rem; background: #f8f9fc; }
      .reo-step-t { font-weight: 600; font-size: .8rem; color: #4154f1; margin-bottom: .15rem; }
      .reo-step-final { background: #e8f5e9; border-color: #a5d6a7; }
      .reo-step-final .reo-step-t { color: #2e7d32; }
      .reo-arrow { align-self: center; font-weight: 700; color: #6b7280; }
    `]
})
export class PurchaseSuggestionComponent implements OnDestroy {
    suggestions:any[] = [];
    /** the product whose stock history is open in the panel on the right (null = closed) */
    historyProduct:{id:number,title:string} | null = null;
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
    /** what the table shows: the suggestions narrowed by the search and the "show" choice */
    view:any[] = [];
    search:string = '';
    show:string = 'all';
    showOptions = [
        { value: 'all', label: 'All products' },
        { value: 'toorder', label: 'Needs ordering' },
        { value: 'onorder', label: 'Already on an order' },
        { value: 'novendor', label: 'No vendor yet' },
        { value: 'selected', label: 'Ticked' }
    ];
    /** the orders just made, to link to them */
    createdOrders:any[] = [];
    /** put the items on the vendor's open draft rather than starting a second one */
    addToDraft:boolean = true;

    /** the "How to read this" panel: closed until asked for, and remembered in this browser */
    private readonly helpKey = 'rgp_reorder_help';
    showHelp:boolean = (() => { try { return localStorage.getItem(this.helpKey) === '1'; } catch { return false; } })();
    toggleHelp(){
        this.showHelp = !this.showHelp;
        try { localStorage.setItem(this.helpKey, this.showHelp ? '1' : '0'); } catch { /* storage blocked: it is just not remembered */ }
    }

    /** the colour of a reason chip: red for what cannot wait, amber for what is running low, blue for what a person asked for, green and grey for the season */
    reasonClass(r:string): string {
        switch(r){
            case 'Urgent': return 'bg-danger';
            case 'Stock Below Zero': return 'bg-danger';
            case 'Below Minimum': return 'bg-warning text-dark';
            case 'Low Stock': return 'bg-warning text-dark';
            case 'Fast Moving': return 'bg-primary';
            case 'Customer Request': return 'bg-info text-dark';
            case 'Season Rising': return 'bg-success';
            case 'Season Easing': return 'bg-secondary';
            case 'Slow Mover': return 'bg-secondary';
            case 'Sold Now Last Year': return 'bg-light text-dark border';
            default: return 'bg-light text-dark border';
        }
    }

    constructor(
        private requestService: PurchaseIntentService,
        private vendorService: VendorsService,
        private orderService: PurchaseOrderService,
        private storeContext: StoreContextService
    ) {}

    /** the store being looked at is the one chosen at the top of the page */
    get storeName(): string {
        const s = this.storeContext.stores.find((x:any) => Number(x.id) === Number(this.storeid));
        return this.storeid && s ? (s.name || s.location || `Store ${this.storeid}`) : 'All stores';
    }

    showHistory(item:any){
        this.historyProduct = item.product_id ? { id: item.product_id, title: item.title } : null;
    }

    ngOnDestroy(){ this.subs.unsubscribe(); }

    ngOnInit(){
        this.vendorService.options(true).subscribe((data:any) => this.vendors = data || []);
        this.storeid = this.storeContext.selectedStoreId;
        this.subs.add(this.storeContext.selectedStoreId$.subscribe((id:any) => {
            if(id !== this.storeid){ this.storeid = id; this.fetchSuggestions(); }
        }));
        this.fetchSuggestions();
    }

    /** `keepMessage`: reloading after orders were made must not wipe the message that says where they went (it used to vanish at once) */
    fetchSuggestions(keepMessage = false){
        if(!keepMessage){ this.feedback = ''; this.createdOrders = []; }
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
            this.applyView();
        });
    }

    /** the search looks in the product, the vendor and the reasons; "show" narrows by what needs doing */
    applyView(){
        const q = `${this.search || ''}`.trim().toLowerCase();
        this.view = this.suggestions.filter((i:any) => {
            if(q && ![i.title, i.vendor_name, i.reason_summary].some((v:any) => `${v || ''}`.toLowerCase().includes(q))) return false;
            switch(this.show){
                case 'toorder': return +i.final_qty > 0;
                case 'onorder': return +i.on_order_qty > 0;
                case 'novendor': return !i.vendor_id;
                case 'selected': return !!i.selected;
                default: return true;
            }
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

        const noVendor = this.suggestions.filter((item:any) => item.selected && item.final_qty > 0 && !item.vendor_id).length;
        if(items.length === 0){
            this.feedback = noVendor ? 'Choose a vendor for the selected product(s) first.' : 'Select at least one suggestion with a positive final quantity.';
            return;
        }
        if(noVendor){
            this.feedback = `${noVendor} selected product(s) have no vendor yet. Choose a vendor for them, or untick them.`;
            return;
        }

        this.requestService.createOrdersFromSuggestions({
            expecteddate: this.expecteddate || null,
            comments: this.comments || null,
            adddraft: this.addToDraft,
            items
        }).subscribe((result:any) => {
            this.createdOrders = result.orders || [];
            const added = this.createdOrders.filter((o:any) => o.reused).length;
            this.feedback = added
                ? `${this.createdOrders.length - added} new draft(s) and ${added} existing draft(s) updated:`
                : `Created ${result.created} draft order(s):`;
            this.orderService.notifyChanged();          // the Orders tab is on this page: it shows the new draft now
            this.fetchSuggestions(true);
        });
    }
}
