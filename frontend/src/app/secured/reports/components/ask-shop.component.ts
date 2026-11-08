import { Component, OnInit } from "@angular/core";
import { InsightsService } from "src/app/shared/insights.service";

/**
 * Ask the shop: type a question in plain words (the assistant picks the report and the period), or press a report button. The answer is always worked out
 * from the shop's own records by a fixed report; the assistant never sees the answer and never makes up a figure.
 */
@Component({
  selector: "app2-ask-shop",
  template: `
    <div class="form-compact">
      <div class="pagetitle"><h1>Reports</h1></div>
      <app2-reports-tabs></app2-reports-tabs>

      <div class="card"><div class="card-body">
        <h5 class="card-title mb-1">Ask the shop</h5>
        <div class="small text-muted mb-2">Ask in your own words, for example "top 10 products last month" or "who owes us money". Only your question goes to the assistant; the answer comes from your own records.</div>
        <div class="input-group" *ngIf="cat?.assistant">
          <input class="form-control" [(ngModel)]="question" maxlength="300" placeholder="Ask a question about your sales, stock, expenses or customers" (keyup.enter)="ask()" data-testid="ask-input">
          <button class="btn btn-primary" type="button" (click)="ask()" [disabled]="busy || question.trim().length < 3" data-testid="ask-go">{{busy ? 'Working...' : 'Ask'}}</button>
        </div>
        <div class="alert alert-light border py-2 small mb-0" *ngIf="cat && !cat.assistant" data-testid="ask-noassistant">Typing a question needs the assistant, which the Business Head switches on under Settings &gt; AI assistant. The report buttons below work without it.</div>
        <div class="small text-danger mt-2" *ngIf="error" data-testid="ask-error">{{error}}</div>
      </div></div>

      <div class="card mt-3"><div class="card-body">
        <div class="d-flex flex-wrap align-items-end gap-2 mb-2">
          <h5 class="card-title m-0 p-0">Or pick a report</h5>
          <div class="ms-auto d-flex align-items-center gap-2">
            <label class="small mb-0" for="ask-period">Period</label>
            <select id="ask-period" class="form-select form-select-sm w-auto" [(ngModel)]="period" data-testid="ask-period">
              <option *ngFor="let p of cat?.periods" [value]="p.key">{{p.label}}</option>
            </select>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2" data-testid="ask-buttons">
          <button *ngFor="let r of cat?.reports" type="button" class="btn btn-sm btn-outline-primary" [title]="r.what + ' E.g. ' + r.example" (click)="pick(r)" [disabled]="busy" [attr.data-testid]="'ask-report-' + r.key">{{r.label}}</button>
        </div>
      </div></div>

      <div class="card mt-3" *ngIf="result" data-testid="ask-result">
        <div class="card-body">
          <div class="small text-muted" *ngIf="understood" data-testid="ask-understood">Understood as: {{understood}}</div>
          <h5 class="card-title mb-0 p-0 mt-2">{{result.label}}</h5>
          <div class="small text-muted mb-2">
            <span *ngIf="result.period">{{result.period.label}}: {{result.period.from}} to {{result.period.to}}.</span>
            <span *ngIf="result.days">Within {{result.days}} days.</span>
            <span *ngIf="result.note"> {{result.note}}</span>
          </div>
          <app2-insight-table [columns]="result.columns" [rows]="result.rows"></app2-insight-table>
        </div>
      </div>
      <div class="alert alert-warning mt-3 py-2" *ngIf="notAnswered" data-testid="ask-notanswered"><strong>No report can answer that.</strong> {{notAnswered}}</div>
    </div>`,
})
export class AskShopComponent implements OnInit {
  cat: any = null;
  question = "";
  period = "last_30_days";
  busy = false;
  error = "";
  result: any = null;
  understood = "";
  notAnswered = "";

  constructor(private insights: InsightsService) {}

  ngOnInit() {
    this.insights.reports().subscribe((c) => (this.cat = c), (e) => (this.error = this.msg(e, "This is for the Business Head and Store Heads.")));
  }

  private msg(e: any, fallback: string) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || fallback); }

  private reset() { this.error = ""; this.notAnswered = ""; this.understood = ""; }

  pick(r: any) {
    this.reset(); this.busy = true;
    this.insights.run({ report: r.key, period: this.period }).subscribe((x) => { this.result = x; this.busy = false; }, (e) => { this.busy = false; this.result = null; this.error = this.msg(e, "That report could not be run."); });
  }

  ask() {
    if (this.question.trim().length < 3) return;
    this.reset(); this.busy = true;
    this.insights.ask(this.question).subscribe((x) => {
      this.busy = false;
      if (x.answered) { this.result = x; this.understood = x.understood; } else { this.result = null; this.notAnswered = x.reason || ""; this.understood = x.understood; }
    }, (e) => { this.busy = false; this.result = null; this.error = this.msg(e, "The question could not be answered."); });
  }
}
