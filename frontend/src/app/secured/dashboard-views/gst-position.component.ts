import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/** The GST position of a month, estimated from the bills, purchase invoices and expenses (owner only). It is not the return. */
@Component({
    selector: 'app-gst-position',
    styles: [':host { display: block; }'],
    template: `
    <section class="card mb-3" aria-label="GST position" data-testid="gst-position" *ngIf="data">
      <div class="card-body">
        <h2 class="h6">GST this month, estimated <span class="text-muted fw-normal small">{{data.month}}</span></h2>
        <div class="row g-2">
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Collected on sales</div><div class="h5 mb-0">{{data.output | number:'1.0-0'}}</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Paid on purchases and costs</div><div class="h5 mb-0">{{data.input | number:'1.0-0'}}</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">{{data.net >= 0 ? 'To pay' : 'Credit'}}</div><div class="h5 mb-0">{{(data.net < 0 ? -data.net : data.net) | number:'1.0-0'}}</div></div></div>
        </div>
        <div class="small text-muted mt-2">{{data.notes[0]}}</div>
      </div>
    </section>`
})
export class GstPositionComponent implements OnChanges {
    @Input() storeid: number | null = null;
    data: any = null;
    constructor(private dashboard: DashboardService) {}
    ngOnChanges(c: SimpleChanges) {
        if (!c.storeid && this.data) return;
        this.dashboard.getFinanceGst(this.storeid).subscribe({ next: (d: any) => (this.data = d), error: () => (this.data = null) });
    }
}
