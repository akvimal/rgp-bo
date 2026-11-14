import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from "@angular/core";
import { Subscription } from "rxjs";
import { DashboardService } from "../dashboard.service";
import { DashboardFilterService, rangeOf } from "../dashboard-filter.service";

/** The GST position of a month, estimated from the bills, purchase invoices and expenses (owner only). It is not the return. */
@Component({
    selector: 'app-gst-position',
    styles: [':host { display: block; }'],
    template: `
    <app-widget title="GST, estimated" testid="gst-position" drill="/secure/gst-filing" [loading]="!data && !error" [error]="error" (retry)="load()"
      definition="Tax collected on sales less tax paid on purchases and costs, for the last month of the chosen period. It is an estimate, not the return.">
      <span sub *ngIf="data">{{data.month}}</span>
      <ng-container *ngIf="data">
        <div class="row g-2">
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Collected on sales</div><div class="h5 mb-0">{{data.output | number:'1.0-0'}}</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Paid on purchases and costs</div><div class="h5 mb-0">{{data.input | number:'1.0-0'}}</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">{{data.net >= 0 ? 'To pay' : 'Credit'}}</div><div class="h5 mb-0">{{(data.net < 0 ? -data.net : data.net) | number:'1.0-0'}}</div></div></div>
        </div>
        <div class="small text-muted mt-2">{{data.notes[0]}}</div>
      </ng-container>
    </app-widget>`
})
export class GstPositionComponent implements OnChanges, OnDestroy {
    @Input() storeid: number | null = null;
    data: any = null;
    error = '';
    private sub: Subscription;
    private first = true;

    constructor(private dashboard: DashboardService, private filter: DashboardFilterService) {
        this.sub = filter.filter$.subscribe(() => { if (this.first) { this.first = false; return; } this.load(); });
    }
    ngOnDestroy() { this.sub.unsubscribe(); }
    ngOnChanges(c: SimpleChanges) { if (c.storeid || !this.data) this.load(); }

    /** the last month of the shared period, but never a month that has not begun */
    private month(): string {
        const now = rangeOf('month').to;
        const to = rangeOf(this.filter.value.period).to;
        return to > now ? now : to;
    }

    load() {
        this.error = '';
        this.dashboard.getFinanceGst(this.storeid, this.month()).subscribe({
            next: (d: any) => { this.data = d; this.error = ''; },
            error: (e) => (this.error = e?.error?.message || 'The GST figures could not be loaded.')
        });
    }
}
