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
          <span class="small text-muted ms-2" *ngIf="ai.configured && ai.provider === 'openrouter' && !ai.model">Choose a model under Alerts, below.</span>
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
        <div class="small text-success mt-2" *ngIf="message" data-testid="aik-message">{{message}}</div>
        <div class="small text-danger mt-2" *ngIf="error" data-testid="aik-error">{{error}}</div>
      </div>
    </div>`,
})
export class AiKeyCardComponent implements OnInit {
  @Output() changed = new EventEmitter<void>();
  ai: any = null;
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
      (r) => { this.busy = false; r.ok ? (this.message = "It works.") : (this.error = "The model answered, but not as expected."); },
      (e) => { this.busy = false; this.error = this.msg(e); });
  }

  remove() {
    this.busy = true; this.message = this.error = "";
    this.alerts.clearAiKey().subscribe(
      () => { this.busy = false; this.message = "Key removed."; this.load(); this.changed.emit(); },
      (e) => { this.busy = false; this.error = this.msg(e); });
  }
}
