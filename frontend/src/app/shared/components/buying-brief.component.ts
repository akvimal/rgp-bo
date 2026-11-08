import { Component, Input } from "@angular/core";
import { InsightsService } from "../insights.service";

/**
 * On the Reorder screen: stock that will not sell before it expires (worked out from the selling rate), and a short brief of what to buy first and what to
 * return or discount. The brief is worded by the assistant when it is on, and in plain words from the same figures when it is not.
 */
@Component({
  selector: "app2-buying-brief",
  template: `
    <div class="card mt-2" data-testid="bb-card">
      <div class="card-body p-2 p-md-3">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <strong><i class="bi bi-lightbulb me-1"></i>Buying brief</strong>
          <span class="small text-muted">What to buy first, and stock that will not sell before it expires.</span>
          <button class="btn btn-sm btn-outline-primary ms-auto" type="button" (click)="make()" [disabled]="busy" data-testid="bb-make">{{busy ? 'Working...' : brief ? 'Refresh the brief' : 'Write the brief'}}</button>
        </div>
        <div class="small text-danger mt-1" *ngIf="error" data-testid="bb-error">{{error}}</div>
        <div *ngIf="brief" class="mt-2" data-testid="bb-brief">
          <div class="fw-semibold" data-testid="bb-headline">{{brief.headline}} <span class="badge bg-light text-dark border ms-1 fw-normal" *ngIf="brief.source === 'assistant'">written by the assistant</span></div>
          <div class="row g-3 mt-0">
            <div class="col-md-6" *ngIf="brief.buyFirst.length"><div class="small fw-semibold">Buy first</div><ul class="small mb-0"><li *ngFor="let x of brief.buyFirst">{{x}}</li></ul></div>
            <div class="col-md-6" *ngIf="brief.clear.length"><div class="small fw-semibold">Return or discount</div><ul class="small mb-0"><li *ngFor="let x of brief.clear">{{x}}</li></ul></div>
          </div>
          <ul class="small text-muted mb-0 mt-1" *ngIf="brief.watch.length"><li *ngFor="let x of brief.watch">{{x}}</li></ul>
          <div class="mt-2" *ngIf="brief.risk.length" data-testid="bb-risk">
            <div class="small fw-semibold">Stock that will not sell in time <span class="text-muted fw-normal">(about &#8377;{{brief.riskTotal | number:'1.0-0'}} at cost)</span></div>
            <app2-insight-table [columns]="riskColumns" [rows]="brief.risk"></app2-insight-table>
          </div>
        </div>
      </div>
    </div>`,
})
export class BuyingBriefComponent {
  /** the rows of the Reorder screen: the most urgent are sent (names and numbers only) */
  @Input() suggestions: any[] = [];
  brief: any = null;
  busy = false;
  error = "";

  readonly riskColumns = [
    { key: "product", label: "Product", type: "text" }, { key: "batch", label: "Batch", type: "text" }, { key: "expires", label: "Expires", type: "date" },
    { key: "qty", label: "Units left", type: "number" }, { key: "unsold", label: "Will not sell", type: "number" }, { key: "value", label: "At cost", type: "money" }, { key: "action", label: "Suggestion", type: "text" },
  ];

  constructor(private insights: InsightsService) {}

  make() {
    this.busy = true; this.error = "";
    const top = (this.suggestions || []).filter((s: any) => +s.final_qty > 0 || (s.reasons || []).length).slice(0, 40)
      .map((s: any) => ({ title: s.title, final_qty: s.final_qty, stock_days_left: s.stock_days_left, reasons: s.reasons || [] }));
    this.insights.buyingBrief(top).subscribe(
      (b) => { this.brief = b; this.busy = false; },
      (e) => { this.busy = false; const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || "The brief could not be written."); });
  }
}
