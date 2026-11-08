import { Component, OnInit } from "@angular/core";
import { InsightsService } from "src/app/shared/insights.service";

/** The weekly owner summary: last week's figures in a few lines (what went well, what to watch, what to do first), made every Monday and sent to the owner on Telegram. */
@Component({
  selector: "app2-weekly-summary",
  template: `
    <div class="form-compact">
      <div class="pagetitle"><h1>Reports</h1></div>
      <app2-reports-tabs></app2-reports-tabs>

      <div class="alert alert-light border py-2 small" *ngIf="error" data-testid="ws-error">{{error}}</div>

      <div class="card" *ngIf="data">
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
            <h5 class="card-title m-0 p-0">Weekly summary</h5>
            <span class="small text-muted">Made every Monday at 8 in the morning for the week before.</span>
            <div class="ms-auto d-flex flex-wrap gap-2 align-items-center">
              <div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" id="ws-tg" [checked]="data.telegram" (change)="setTelegram($any($event.target).checked)" data-testid="ws-telegram"><label class="form-check-label small" for="ws-tg">Send to my Telegram</label></div>
              <button class="btn btn-sm btn-outline-primary" type="button" (click)="make(false)" [disabled]="busy" data-testid="ws-make">{{current ? 'Refresh last week' : 'Make last week\\'s summary'}}</button>
            </div>
          </div>
          <div class="small text-success mt-2" *ngIf="message" data-testid="ws-message">{{message}}</div>
        </div>
      </div>

      <div class="card mt-3" *ngIf="current" data-testid="ws-card">
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <select class="form-select form-select-sm w-auto" [ngModel]="current.id" (ngModelChange)="choose($event)" aria-label="Week" data-testid="ws-week">
              <option *ngFor="let s of data.items" [value]="s.id">{{s.week_start}} to {{s.week_end}}</option>
            </select>
            <span class="badge bg-light text-dark border" *ngIf="current.source === 'assistant'">worded by the assistant</span>
            <span class="badge bg-light text-dark border" *ngIf="current.source !== 'assistant'">plain words from the figures</span>
            <span class="small text-muted ms-auto" *ngIf="current.sent_on">Sent to {{current.sent_to}} on Telegram</span>
            <button class="btn btn-sm btn-outline-secondary" type="button" (click)="send()" [disabled]="busy" data-testid="ws-send">Send to Telegram now</button>
          </div>
          <h4 class="mt-3" data-testid="ws-headline">{{current.headline}}</h4>

          <div class="row g-3 mt-0">
            <div class="col-md-6" *ngIf="current.wins.length" data-testid="ws-wins"><div class="fw-semibold text-success small mb-1"><i class="bi bi-hand-thumbs-up me-1"></i>Went well</div><ul class="mb-0"><li *ngFor="let x of current.wins">{{x}}</li></ul></div>
            <div class="col-md-6" *ngIf="current.watch.length" data-testid="ws-watch"><div class="fw-semibold text-warning small mb-1"><i class="bi bi-exclamation-triangle me-1"></i>Watch</div><ul class="mb-0"><li *ngFor="let x of current.watch">{{x}}</li></ul></div>
          </div>
          <div class="mt-3" *ngIf="current.do_first.length" data-testid="ws-first"><div class="fw-semibold small mb-1"><i class="bi bi-list-check me-1"></i>Do first</div><ol class="mb-0"><li *ngFor="let x of current.do_first">{{x}}</li></ol></div>

          <div class="row g-2 mt-3" *ngIf="current.facts">
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Sales</div><div class="fw-bold">&#8377;{{current.facts.sales.value | number:'1.0-0'}}</div><div class="small text-muted">{{current.facts.sales.bills}} bills, before: &#8377;{{current.facts.sales.prevValue | number:'1.0-0'}}</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Cash / UPI / credit</div><div class="fw-bold small">&#8377;{{current.facts.mix.cash | number:'1.0-0'}} / &#8377;{{current.facts.mix.digital | number:'1.0-0'}} / &#8377;{{current.facts.mix.credit | number:'1.0-0'}}</div></div></div>
            <div class="col-6 col-md-3" *ngIf="current.facts.margin && current.facts.margin.pct !== null"><div class="border rounded p-2"><div class="small text-muted">Gross margin</div><div class="fw-bold">{{current.facts.margin.pct}}%</div><div class="small text-muted" *ngIf="current.facts.margin.prevPct !== null">before: {{current.facts.margin.prevPct}}%</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Expenses</div><div class="fw-bold">&#8377;{{current.facts.expenses.total | number:'1.0-0'}}</div><div class="small text-muted">before: &#8377;{{current.facts.expenses.prevTotal | number:'1.0-0'}}</div></div></div>
          </div>
        </div>
      </div>
      <div class="text-muted small mt-3" *ngIf="data && !current" data-testid="ws-none">No summary has been made yet. Press the button above to make the summary of last week.</div>
    </div>`,
})
export class WeeklySummaryComponent implements OnInit {
  data: any = null;
  current: any = null;
  busy = false;
  error = "";
  message = "";

  constructor(private insights: InsightsService) {}

  ngOnInit() { this.load(); }

  private msg(e: any, fallback: string) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || fallback); }

  load(selectId?: number) {
    this.insights.weekly().subscribe((d) => {
      this.data = d;
      this.current = (selectId && d.items.find((x: any) => x.id === selectId)) || d.items[0] || null;
    }, (e) => (this.error = this.msg(e, "The weekly summary is for the Business Head.")));
  }

  choose(id: any) { this.current = this.data.items.find((x: any) => x.id === Number(id)) || this.current; }

  make(force: boolean) {
    this.busy = true; this.message = ""; this.error = "";
    this.insights.makeWeekly(true).subscribe((s) => { this.busy = false; this.message = "The summary of last week is ready."; this.load(s.id); }, (e) => { this.busy = false; this.error = this.msg(e, "The summary could not be made."); });
  }

  send() {
    if (!this.current) return;
    this.busy = true; this.message = ""; this.error = "";
    this.insights.sendWeekly(this.current.id).subscribe((r) => { this.busy = false; this.message = r.sent ? `Sent to ${r.sent} on Telegram.` : "Nobody has connected Telegram yet, so nothing was sent."; this.load(this.current.id); }, (e) => { this.busy = false; this.error = this.msg(e, "It could not be sent."); });
  }

  setTelegram(on: boolean) {
    this.insights.weeklyTelegram(on).subscribe((d) => { this.data = { ...this.data, telegram: d.telegram }; this.message = on ? "The summary will be sent to your Telegram every Monday." : "The summary stays in the app."; }, (e) => (this.error = this.msg(e, "Could not change that.")));
  }
}
