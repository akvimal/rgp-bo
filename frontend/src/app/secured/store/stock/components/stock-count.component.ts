import { Component, OnInit } from "@angular/core";
import { StockService } from "../stock.service";
import { StoreContextService } from "src/app/@core/store-context.service";

@Component({
    templateUrl: './stock-count.component.html'
})
export class StockCountComponent implements OnInit {

    counts:any[] = [];
    loading = false;
    message = '';

    categoryFilter = '';
    active:any = null; // { count, items }
    submitting = false;
    result:any = null;

    constructor(private service: StockService, private storeContext: StoreContextService) {}

    ngOnInit(): void {
        this.refresh();
    }

    refresh() {
        this.loading = true;
        this.service.findCounts().subscribe((data:any) => {
            this.counts = data || [];
            this.loading = false;
        }, () => this.loading = false);
    }

    startCount() {
        this.message = '';
        this.result = null;
        // scoped to the store currently selected in the header - a physical count is done at
        // one location, and the resulting adjustments should land there, not at whichever
        // store originally received each batch.
        this.service.startCount(this.categoryFilter || undefined, this.storeContext.selectedStoreId).subscribe((data:any) => {
            this.active = {
                count: data.count,
                items: (data.items || []).map((i:any) => ({ ...i, countedqty: i.balance }))
            };
        }, (err:any) => this.message = err?.error?.message || 'Unable to start a count.');
    }

    viewDetail(count:any) {
        this.message = '';
        this.service.findCountDetail(count.id).subscribe((detail:any) => {
            this.result = { detail: true, count: detail.count, adjustments: detail.lines };
        });
    }

    submitCount() {
        if (!this.active) return;
        this.submitting = true;
        this.message = '';
        const items = this.active.items.map((i:any) => ({
            itemid: i.item_id, bookqty: i.balance, countedqty: i.countedqty
        }));
        this.service.submitCount(this.active.count.id, items).subscribe((res:any) => {
            this.submitting = false;
            this.result = res;
            this.active = null;
            this.categoryFilter = '';
            this.refresh();
        }, (err:any) => {
            this.submitting = false;
            this.message = err?.error?.message || 'Unable to submit the count.';
        });
    }

    cancelCount() {
        this.active = null;
        this.message = '';
    }

    diff(item:any) {
        return Number(item.countedqty || 0) - Number(item.balance || 0);
    }
}
