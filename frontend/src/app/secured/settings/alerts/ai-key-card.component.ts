import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { AlertsService } from "../../alerts/alerts.service";

/** The assistant's key: pasted here by the Business Head, kept encrypted on the server, never shown again. Used by every assistant in the app. */
@Component({
  selector: "app2-ai-key-card",
  template: `
    <div class="card mt-3" *ngIf="ai" data-testid="aik-card">
      <div class="card-body">
        <h5 class="card-title m-0 p-0 mt-3">AI assistant</h5>
        <div class="small text-muted mb-2">Drafts alert rules, checklists, job roles, KPIs and incentive proposals. Only anonymous totals leave this server, never names, salaries or bills. Nothing it drafts is used until you approve it.</div>
        <div class="alert alert-warning py-2" *ngIf="ai.off" data-testid="aik-off">The assistant is switched off for this server.</div>
        <div class="mb-2" *ngIf="!ai.off">
          <span class="badge bg-success" *ngIf="ai.configured" data-testid="aik-on">On</span>
          <span class="badge bg-secondary" *ngIf="!ai.configured" data-testid="aik-notset">No key yet</span>
          <span class="small ms-2" *ngIf="ai.configured">through {{ai.provider === 'openrouter' ? 'OpenRouter' : 'Anthropic'}}, key
            {{ai.keySource === 'app' ? 'saved here ' + (ai.keyHint || '') : 'set on the server'}}</span>
          <span class="small text-muted ms-2" *ngIf="ai.configured && ai.provider === 'openrouter' && !ai.model">Choose the models below.</span>
        </div>
        <div class="row g-2 align-items-end" *ngIf="!ai.off">
          <div class="col-auto"><label class="form-label mb-0">Provider</label>
            <select class="form-select form-select-sm" [(ngModel)]="provider" data-testid="aik-provider"><option value="openrouter">OpenRouter</option><option value="anthropic">Anthropic</option></select></div>
          <div class="col-md-5"><label class="form-label mb-0">{{ai.keySource === 'app' ? 'Replace the key' : 'API key'}}</label>
            <input type="password" class="form-control form-control-sm" autocomplete="off" [(ngModel)]="key" placeholder="Paste the key" data-testid="aik-key"></div>
          <div class="col-auto">
            <button class="btn btn-sm btn-primary" type="button" [disabled]="busy || key.trim().length < 20" (click)="save()" data-testid="aik-save">Save key</button>
            <button class="btn btn-sm btn-outline-secondary ms-1" type="button" [disabled]="busy || !ai.configured" (click)="test()" data-testid="aik-test">Test</button>
            <button class="btn btn-sm btn-outline-danger ms-1" type="button" *ngIf="ai.keySource === 'app'" [disabled]="busy" (click)="remove()" data-testid="aik-remove">Remove key</button>
          </div>
        </div>
        <div class="mt-3 pt-3 border-top" *ngIf="usage && !ai.off" data-testid="aik-usage">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <strong>This month</strong>
            <span data-testid="aik-used">{{usage.used}} {{usage.limit ? 'of ' + usage.limit : ''}} request{{usage.used === 1 ? '' : 's'}}{{usage.limit ? '' : ' (no limit)'}}</span>
            <span class="badge bg-warning text-dark" *ngIf="usage.state === 'near'" data-testid="aik-near">Nearly at the limit</span>
            <span class="badge bg-danger" *ngIf="usage.state === 'reached'" data-testid="aik-reached">Limit reached: the assistants have stopped until next month or until you raise it</span>
            <span class="small text-muted ms-auto">Last month: {{usage.last_month}}</span>
          </div>
          <div class="progress my-2" style="height:6px" *ngIf="usage.limit">
            <div class="progress-bar" [ngClass]="usage.state === 'reached' ? 'bg-danger' : usage.state === 'near' ? 'bg-warning' : 'bg-success'" [style.width.%]="pct()"></div>
          </div>
          <div class="row g-2 align-items-end mb-2">
            <div class="col-auto"><label class="form-label mb-0 small">Requests allowed each month (0 = no limit)</label>
              <input type="number" min="0" class="form-control form-control-sm" style="width:9rem" [(ngModel)]="limitInput" data-testid="aik-limit"></div>
            <div class="col-auto"><button class="btn btn-sm btn-outline-primary" type="button" [disabled]="busy" (click)="saveLimit()" data-testid="aik-limit-save">Save limit</button></div>
          </div>
          <table class="table table-sm small mb-0" *ngIf="usage.by_feature.length" data-testid="aik-features">
            <thead><tr><th>Assistant</th><th class="text-end">Requests</th><th class="text-end">Failed</th><th class="text-end">Tokens in</th><th class="text-end">Tokens out</th></tr></thead>
            <tbody><tr *ngFor="let f of usage.by_feature"><td>{{f.label}}</td><td class="text-end">{{f.calls}}</td><td class="text-end">{{f.failed}}</td><td class="text-end">{{f.input_tokens}}</td><td class="text-end">{{f.output_tokens}}</td></tr></tbody>
          </table>
          <div class="small text-muted" *ngIf="!usage.by_feature.length">No requests yet this month. Each draft the assistants make counts as one request. Only the numbers are kept, never the text.</div>
        </div>
        <div class="small text-success mt-2" *ngIf="message" data-testid="aik-message">{{message}}</div>
        <div class="small text-danger mt-2" *ngIf="error" data-testid="aik-error">{{error}}</div>
      </div>
    </div>`,
})
export class AiKeyCardComponent implements OnInit {
  @Output() changed = new EventEmitter<void>();
  ai: any = null;
  usage: any = null;
  limitInput = 0;
  provider = "openrouter";
  key = "";
  busy = false;
  message = "";
  error = "";

  constructor(private alerts: AlertsService) {}

  ngOnInit() { this.load(); }

  private load() {
    // only the owner may see this; anyone else gets a refusal and the card stays hidden
    this.alerts.ai().subscribe((a) => { this.ai = a; if (a.keyProvider) this.provider = a.keyProvider; }, () => (this.ai = null));
    this.loadUsage();
  }

  private loadUsage() {
    this.alerts.aiUsage().subscribe((u) => { this.usage = u; this.limitInput = u.limit; }, () => (this.usage = null));
  }

  pct() { return this.usage?.limit ? Math.min(100, Math.round((this.usage.used / this.usage.limit) * 100)) : 0; }

  saveLimit() {
    this.busy = true; this.message = this.error = "";
    this.alerts.saveAiLimit(Number(this.limitInput)).subscribe(
      (u) => { this.busy = false; this.usage = u; this.limitInput = u.limit; this.message = "Limit saved."; },
      (e) => { this.busy = false; this.error = this.msg(e); });
  }

  private msg(e: any) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || "Something went wrong."); }

  save() {
    this.busy = true; this.message = this.error = "";
    this.alerts.saveAiKey(this.provider, this.key.trim()).subscribe(
      () => { this.busy = false; this.key = ""; this.message = "Key saved."; this.load(); this.changed.emit(); },
      (e) => { this.busy = false; this.error = this.msg(e); });
  }

  test() {
    this.busy = true; this.message = this.error = "";
    this.alerts.testAi().subscribe(
      (r) => { this.busy = false; this.loadUsage(); r.ok ? (this.message = "It works.") : (this.error = "The model answered, but not as expected."); },
      (e) => { this.busy = false; this.loadUsage(); this.error = this.msg(e); });
  }

  remove() {
    this.busy = true; this.message = this.error = "";
    this.alerts.clearAiKey().subscribe(
      () => { this.busy = false; this.message = "Key removed."; this.load(); this.changed.emit(); },
      (e) => { this.busy = false; this.error = this.msg(e); });
  }
}
