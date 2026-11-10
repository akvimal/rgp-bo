import { Component, OnInit } from "@angular/core";
import { AlertsService } from "../../alerts/alerts.service";

/**
 * Settings > AI assistant: the key, how much the assistants may be used, and which model does which job.
 * A job uses the first of: its own model, the model of its level of difficulty, the default model.
 */
@Component({
  selector: "app2-ai-assistant-settings",
  template: `
    <div class="form-compact">
      <div class="small text-muted mb-1">One assistant for the whole app: it drafts alert rules, checklists, job roles, KPIs and incentive proposals. Only the Business Head sets it up.</div>
      <app2-ai-key-card (changed)="load()"></app2-ai-key-card>
      <app2-ai-usage-report *ngIf="cfg && cfg.configured && !cfg.off"></app2-ai-usage-report>

      <div class="card mt-3" *ngIf="cfg && cfg.configured && !cfg.off && inv" data-testid="air-card">
        <div class="card-body">
          <h5 class="card-title m-0 p-0 mt-3">Reading invoice copies</h5>
          <div class="small text-muted mb-2">When a scanned or photographed purchase invoice is attached, the plain reader tries first. If what it read does not add up to the invoice total, it can ask the assistant. The assistant only reads: the result is checked against the invoice total, and a person checks every line.</div>
          <div class="form-check"><input class="form-check-input" type="radio" name="air" id="air-off" value="off" [(ngModel)]="invMode" data-testid="air-off"><label class="form-check-label" for="air-off"><b>Off</b>: only the plain reader is used.</label></div>
          <div class="form-check"><input class="form-check-input" type="radio" name="air" id="air-text" value="text" [(ngModel)]="invMode" data-testid="air-text"><label class="form-check-label" for="air-text"><b>Words</b>: the text read from the scan is sent to the assistant. Cheap and usually enough. No picture leaves the server.</label></div>
          <div class="form-check"><input class="form-check-input" type="radio" name="air" id="air-full" value="full" [(ngModel)]="invMode" data-testid="air-full"><label class="form-check-label" for="air-full"><b>Words, then pictures</b>: if the words are not enough, the pages are sent as pictures. Most accurate, costs more. The model chosen for Invoice reading below must be able to read pictures.</label></div>
          <div class="small text-muted mt-2">Invoices show vendor names, products and prices, not patient details. Switch it on only if you are happy for invoice copies to go to {{cfg.provider === 'openrouter' ? 'OpenRouter and the model you chose' : 'Anthropic'}}.</div>
          <button class="btn btn-sm btn-primary mt-2" type="button" [disabled]="invBusy || invMode === inv.mode" (click)="saveInvoiceMode()" data-testid="air-save">Save</button>
          <span class="small text-success ms-2" *ngIf="invMessage" data-testid="air-message">{{invMessage}}</span>
          <span class="small text-danger ms-2" *ngIf="invError" data-testid="air-error">{{invError}}</span>
        </div>
      </div>

      <div class="card mt-3" *ngIf="cfg && cfg.configured && !cfg.off" data-testid="aim-card">
        <div class="card-body">
          <h5 class="card-title m-0 p-0 mt-3">Which model does which job</h5>
          <div class="small text-muted mb-3">A small, cheap model is fine for short wording jobs; give the hard jobs a more capable one. Each job uses the first that applies: its own model, then the model for its level, then the default. Leave a box empty to follow the one above it.
            Running through {{cfg.provider === 'openrouter' ? 'OpenRouter' : 'Anthropic'}}.</div>

          <div class="row g-2 align-items-end mb-3">
            <div class="col-md-6"><label class="form-label mb-0" for="aim-default">Default model</label>
              <input id="aim-default" class="form-control form-control-sm" list="aim-models" [(ngModel)]="draft.default" [placeholder]="cfg.chosen ? '' : 'Server default: ' + (serverDefault || 'none')" data-testid="aim-default"></div>
            <div class="col-auto" *ngIf="canSuggest"><button class="btn btn-sm btn-outline-secondary" type="button" (click)="suggest()" data-testid="aim-suggest">Suggest a spread (small, mid, large)</button></div>
          </div>
          <datalist id="aim-models"><option *ngFor="let m of cfg.models" [value]="m.id">{{label(m)}}</option></datalist>

          <div class="table-responsive">
            <table class="table table-sm align-middle mb-2" data-testid="aim-table">
              <thead><tr><th style="width:22%">Job</th><th>Model</th><th style="width:28%">In use</th></tr></thead>
              <tbody>
                <ng-container *ngFor="let t of cfg.tiers">
                  <tr class="table-light" [attr.data-testid]="'aim-tier-' + t.tier">
                    <td><strong>{{t.label}} jobs</strong><div class="small text-muted">{{t.hint}}</div></td>
                    <td><input class="form-control form-control-sm" list="aim-models" [(ngModel)]="draft.tiers[t.tier]" [placeholder]="'Same as the default'" [attr.data-testid]="'aim-tier-model-' + t.tier"></td>
                    <td class="small">{{levelUses(t.tier) || 'no model chosen'}}</td>
                  </tr>
                  <tr *ngFor="let k of tasksOf(t.tier)" [attr.data-testid]="'aim-task-' + k.task">
                    <td class="ps-4">{{k.label}}</td>
                    <td><input class="form-control form-control-sm" list="aim-models" [(ngModel)]="draft.tasks[k.task]" [placeholder]="'Same as ' + t.label.toLowerCase() + ' jobs'" [attr.data-testid]="'aim-task-model-' + k.task"></td>
                    <td class="small" [attr.data-testid]="'aim-uses-' + k.task">{{uses(k.task) || 'no model chosen'}}</td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </div>
          <button class="btn btn-sm btn-primary" type="button" [disabled]="busy || !changed" (click)="save()" data-testid="aim-save">Save models</button>
          <span class="small text-success ms-2" *ngIf="message" data-testid="aim-message">{{message}}</span>
          <span class="small text-danger ms-2" *ngIf="error" data-testid="aim-error">{{error}}</span>
        </div>
      </div>
      <div class="small text-muted mt-3" *ngIf="cfg && !cfg.configured && !cfg.off" data-testid="aim-nokey">Add the key above, then you can choose the models.</div>
    </div>`,
})
export class AiAssistantSettingsComponent implements OnInit {
  cfg: any = null;
  /** how scanned purchase invoices are read: what is saved, and what is chosen */
  inv: any = null;
  invMode = "off";
  invBusy = false;
  invMessage = "";
  invError = "";
  draft: { default: string; tiers: { [k: string]: string }; tasks: { [k: string]: string } } = { default: "", tiers: {}, tasks: {} };
  busy = false;
  message = "";
  error = "";

  constructor(private alerts: AlertsService) {}

  ngOnInit() { this.load(); }

  load() {
    this.alerts.ai().subscribe((c) => { this.cfg = c; this.reset(c); }, () => (this.cfg = null));
    this.alerts.invoiceReading().subscribe((r) => { this.inv = r; this.invMode = r.mode; }, () => (this.inv = null));
  }

  saveInvoiceMode() {
    this.invBusy = true; this.invMessage = this.invError = "";
    this.alerts.saveInvoiceReading(this.invMode).subscribe(
      (r) => { this.invBusy = false; this.inv = r; this.invMode = r.mode; this.invMessage = "Saved."; },
      (e) => { this.invBusy = false; this.invError = this.msg(e); });
  }

  private reset(c: any) {
    this.draft = { default: c.chosen ? c.model : "", tiers: {}, tasks: {} };
    for (const t of c.tiers) this.draft.tiers[t.tier] = t.model || "";
    for (const k of c.tasks) this.draft.tasks[k.task] = k.model || "";
  }

  get serverDefault(): string { return this.cfg && !this.cfg.chosen ? this.cfg.model : ""; }

  tasksOf(tier: string) { return this.cfg.tasks.filter((k: any) => k.tier === tier); }

  /** what a job would use with the boxes as they stand now */
  uses(task: string): string {
    const k = this.cfg.tasks.find((x: any) => x.task === task);
    return (this.draft.tasks[task] || "").trim() || this.levelUses(k.tier);
  }

  levelUses(tier: string): string {
    return (this.draft.tiers[tier] || "").trim() || (this.draft.default || "").trim() || this.serverDefault;
  }

  label(m: any) {
    const price = m.promptPer1M !== null && m.completionPer1M !== null ? ` - $${m.promptPer1M} in / $${m.completionPer1M} out per 1M tokens` : "";
    return `${m.name}${price}`;
  }

  get changed(): boolean {
    if (!this.cfg) return false;
    if ((this.draft.default || "").trim() !== (this.cfg.chosen ? this.cfg.model : "")) return true;
    return this.cfg.tiers.some((t: any) => (this.draft.tiers[t.tier] || "").trim() !== (t.model || "")) || this.cfg.tasks.some((k: any) => (this.draft.tasks[k.task] || "").trim() !== (k.model || ""));
  }

  /** a direct Anthropic key can use the small, mid and large model of the family */
  private readonly spread = { simple: "claude-haiku-5-5", standard: "claude-sonnet-5-5", complex: "claude-opus-5-5" };
  get canSuggest(): boolean {
    return !!this.cfg && Object.values(this.spread).every((id) => this.cfg.models.some((m: any) => m.id === id));
  }
  suggest() { this.draft.tiers = { ...this.draft.tiers, ...this.spread }; this.message = this.error = ""; }

  private msg(e: any) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || "Something went wrong."); }

  save() {
    this.busy = true; this.message = this.error = "";
    const trim = (o: { [k: string]: string }) => { const out: { [k: string]: string } = {}; Object.keys(o).forEach((k) => (out[k] = (o[k] || "").trim())); return out; };
    this.alerts.saveAiModels({ default: (this.draft.default || "").trim(), tiers: trim(this.draft.tiers), tasks: trim(this.draft.tasks) }).subscribe(
      (c) => { this.busy = false; this.cfg = c; this.reset(c); this.message = "Models saved."; },
      (e) => { this.busy = false; this.error = this.msg(e); });
  }
}
