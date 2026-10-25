import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { StockService } from "../stock.service";
import { StoreContextService } from "src/app/@core/store-context.service";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

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
    /** when counting finished (leave blank for now): sales and other movements up to then are taken into account */
    finishedAt = '';
    result:any = null;

    /** set when this count was opened from a routine stock audit */
    auditId:number|null = null;

    constructor(private service: StockService, private storeContext: StoreContextService, private route: ActivatedRoute, private http: HttpClient) {}

    ngOnInit(): void {
        const q = this.route.snapshot.queryParamMap;
        this.auditId = Number(q.get('audit')) || null;
        if (this.auditId && q.get('category')) { this.categoryFilter = q.get('category') as string; }
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
        this.service.startCount(this.categoryFilter || undefined, this.storeContext.selectedStoreId, this.auditId).subscribe((data:any) => {
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
        const finished = this.finishedAt ? new Date(this.finishedAt).toISOString() : undefined;
        this.service.submitCount(this.active.count.id, items, finished).subscribe((res:any) => {
            this.finishedAt = '';
            this.submitting = false;
            this.result = res;
            this.active = null;
            this.categoryFilter = '';
            if (this.auditId) { this.message = 'Audit completed.'; this.auditId = null; }
            this.refresh();
        }, (err:any) => {
            this.submitting = false;
            this.message = err?.error?.message || 'Unable to submit the count.';
        });
    }

    /** the count sheet of the audit being counted: the book quantities as fixed when the count started */
    printSheet() {
        if (!this.auditId) return;
        this.http.get(`${environment.apiHost}/stock-audits/${this.auditId}/sheet`, { responseType: 'blob' }).subscribe((b:Blob) => {
            const url = URL.createObjectURL(b);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }, () => this.message = 'Could not make the count sheet.');
    }

    cancelCount() {
        this.active = null;
        this.message = '';
    }

    diff(item:any) {
        return Number(item.countedqty || 0) - Number(item.balance || 0);
    }
}
