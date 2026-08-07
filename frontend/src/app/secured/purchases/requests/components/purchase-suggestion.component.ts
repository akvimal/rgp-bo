import { Component } from "@angular/core";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";
import { VendorsService } from "../../vendors/vendors.service";

@Component({
    templateUrl: './purchase-suggestion.component.html'
})
export class PurchaseSuggestionComponent {
    suggestions:any[] = [];
    vendors:any[] = [];
    vendorid:string = '';
    days:number = 30;
    targetdays:number = 21;
    expecteddate:string = '';
    comments:string = '';
    feedback:string = '';

    constructor(
        private requestService: PurchaseIntentService,
        private vendorService: VendorsService
    ) {}

    ngOnInit(){
        this.vendorService.findAll().subscribe((data:any) => this.vendors = data || []);
        this.fetchSuggestions();
    }

    fetchSuggestions(){
        this.feedback = '';
        const params:any = {
            days: this.days,
            targetdays: this.targetdays
        };
        if(this.vendorid){
            params.vendorid = this.vendorid;
        }
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
