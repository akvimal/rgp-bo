import { Component, OnInit } from "@angular/core";
import { ExpenseApi } from "./expense.service";

/** Approved expenses by category, store and month, with till expenses (the Cash screen) added in. */
@Component({
  selector: "app-expense-report",
  template: `
    <div class="card"><div class="card-body pt-3">
      <div class="page-toolbar">
        <div class="page-toolbar-main">
          <div><label class="form-label">From</label><input type="date" class="form-control" [(ngModel)]="from" (change)="load()" data-testid="rep-from"></div>
          <div><label class="form-label">To</label><input type="date" class="form-control" [(ngModel)]="to" (change)="load()" data-testid="rep-to"></div>
        </div>
        <div class="page-toolbar-actions"><button class="btn btn-outline-secondary" type="button" (click)="download()" data-testid="rep-download" [disabled]="!data">Download CSV</button></div>
      </div>
      <div *ngIf="error" class="alert alert-danger py-2">{{error}}</div>
      <div *ngIf="data">
        <div class="mb-3">Total <strong data-testid="rep-total">{{data.total | number:'1.2-2'}}</strong>
          <span class="text-muted"> &middot; GST included {{data.gst | number:'1.2-2'}} &middot; of which till (Cash screen) {{data.till | number:'1.2-2'}}</span>
          <span class="badge bg-warning text-dark ms-2" *ngIf="data.pending?.n">{{data.pending.n}} pending, {{data.pending.total | number:'1.2-2'}} not counted yet</span></div>
        <div class="row g-4">
          <div class="col-lg-4"><h6>By category</h6><table class="table table-sm" data-testid="rep-cat"><tbody><tr *ngFor="let r of data.byCategory"><td>{{r.name}}</td><td class="text-end">{{r.amount | number:'1.2-2'}}</td></tr></tbody></table></div>
          <div class="col-lg-4"><h6>By store</h6><table class="table table-sm" data-testid="rep-store"><tbody><tr *ngFor="let r of data.byStore"><td>{{r.name}}</td><td class="text-end">{{r.amount | number:'1.2-2'}}</td></tr></tbody></table></div>
          <div class="col-lg-4"><h6>By month</h6><table class="table table-sm" data-testid="rep-month"><tbody><tr *ngFor="let r of data.byMonth"><td>{{r.name}}</td><td class="text-end">{{r.amount | number:'1.2-2'}}</td></tr></tbody></table></div>
        </div>
      </div>
    </div></div>`
})
export class ExpenseReportComponent implements OnInit {
  from = "";
  to = "";
  data: any = null;
  error = "";

  constructor(private api: ExpenseApi) {}

  ngOnInit() {
    this.from = this.api.thisMonth() + "-01";
    this.to = this.api.today();
    this.load();
  }

  load() { this.api.get("report", { from: this.from, to: this.to }).subscribe(r => this.data = r, e => this.error = this.api.msg(e)); }

  download() {
    const lines: any[][] = [["Report", `${this.data.from} to ${this.data.to}`], [], ["By category", "Amount"], ...this.data.byCategory.map((r: any) => [r.name, r.amount]),
      [], ["By store", "Amount"], ...this.data.byStore.map((r: any) => [r.name, r.amount]), [], ["By month", "Amount"], ...this.data.byMonth.map((r: any) => [r.name, r.amount]), [], ["Total", this.data.total]];
    const csv = lines.map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `expenses-${this.data.from}-to-${this.data.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
