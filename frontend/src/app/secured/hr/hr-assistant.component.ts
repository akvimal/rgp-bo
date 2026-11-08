import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/**
 * Role assistant: for each job role the AI drafts the description, the KPIs and the incentive bands, and the Business Head reviews, edits and
 * approves each step. Nothing it drafts is used until it is approved here.
 */
@Component({
  selector: "app-hr-assistant",
  template: `
    <div class="alert alert-warning py-2" *ngIf="status && !status.configured" data-testid="as-off">
      The assistant has no key yet. Add it under <a routerLink="/secure/settings/business-profile/ai">Settings &gt; AI assistant</a>. You can still read and edit everything here.
    </div>
    <div class="alert alert-success py-2" *ngIf="message" data-testid="as-message">{{message}}</div>
    <div class="alert alert-danger py-2" *ngIf="error" data-testid="as-error">{{error}}</div>

    <ng-container *ngIf="!sel">
      <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div class="small text-muted flex-grow-1">The assistant drafts a job description, the KPIs and the incentive bands for each job role. Only anonymous totals are sent to it. You approve every step.</div>
        <div *ngIf="status">
          <label class="form-label mb-0 small">Incentive ceiling (% of a role's monthly payroll)</label>
          <div class="input-group input-group-sm" style="width:14rem">
            <input type="number" min="0" max="100" class="form-control" [(ngModel)]="ceiling" placeholder="none" data-testid="as-ceiling">
            <button class="btn btn-outline-secondary" type="button" (click)="saveCeiling()" data-testid="as-ceiling-save">Save</button>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" type="button" (click)="openNext()" [disabled]="!nextRole()" data-testid="as-all">Set up all roles</button>
      </div>
      <table class="table table-sm align-middle" data-testid="as-roles">
        <thead><tr><th>Job role</th><th>Staff</th><th>Description</th><th>KPIs</th><th>Incentive bands</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of roles" data-testid="as-role" [attr.data-id]="r.id">
            <td>{{r.name}}</td><td>{{r.staff}}</td>
            <td><span class="badge" [ngClass]="r.jd_approved_on ? 'bg-success' : 'bg-secondary'">{{r.jd_approved_on ? 'Approved' : r.has_description ? 'Draft' : 'None'}}</span></td>
            <td><span class="badge" [ngClass]="r.measures ? 'bg-success' : 'bg-secondary'">{{r.measures || 'None'}}</span></td>
            <td><span class="badge" [ngClass]="r.bands ? 'bg-success' : 'bg-secondary'">{{r.bands ? (r.amount_bands ? r.bands + ', fixed amounts' : r.bands + ', percent') : 'None'}}</span></td>
            <td class="text-end"><button class="btn btn-outline-primary btn-sm" type="button" (click)="open(r)" data-testid="as-open">Set up</button></td>
          </tr>
          <tr *ngIf="!roles.length"><td colspan="6" class="text-center text-muted py-2">No job roles yet. Add them under Setup, or create them from staff designations.</td></tr>
        </tbody>
      </table>
    </ng-container>

    <ng-container *ngIf="sel">
      <div class="d-flex align-items-center gap-2 mb-2">
        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="close()" data-testid="as-back">&larr; All roles</button>
        <h5 class="m-0">{{sel.name}}</h5><span class="text-muted small">{{sel.staff}} staff</span>
      </div>
      <ul class="nav nav-pills mb-3">
        <li class="nav-item" *ngFor="let s of steps"><a class="nav-link" [class.active]="step === s.n" role="button" (click)="step = s.n" [attr.data-testid]="'as-step-' + s.n">{{s.n}}. {{s.label}}</a></li>
      </ul>

      <div *ngIf="step === 1" data-testid="as-step1">
        <div class="row g-2 mb-2"><div class="col-md-8"><input class="form-control form-control-sm" maxlength="300" [(ngModel)]="notes" placeholder="Anything the assistant should know? (optional) e.g. also delivers medicines nearby" data-testid="as-notes"></div>
          <div class="col-auto"><button class="btn btn-primary btn-sm" type="button" [disabled]="busy" (click)="draftRole()" data-testid="as-draft-role">{{busy ? 'Thinking...' : 'Draft with AI'}}</button></div></div>
        <ng-container *ngIf="role">
          <label class="form-label mb-0 small">What the role is for</label>
          <textarea class="form-control form-control-sm mb-2" rows="2" maxlength="300" [(ngModel)]="role.purpose" data-testid="as-purpose"></textarea>
          <label class="form-label mb-0 small">Responsibilities</label>
          <div class="input-group input-group-sm mb-1" *ngFor="let x of role.responsibilities; let i = index" data-testid="as-resp">
            <input class="form-control" maxlength="160" [(ngModel)]="x.text">
            <span class="input-group-text">{{measureLabel(x.measure)}}</span>
            <button class="btn btn-outline-danger" type="button" (click)="role.responsibilities.splice(i, 1)">Remove</button>
          </div>
          <button class="btn btn-sm btn-outline-secondary mb-2" type="button" (click)="role.responsibilities.push({ text: '', measure: 'MANUAL' })">Add one</button>
          <div><button class="btn btn-success btn-sm" type="button" [disabled]="busy" (click)="saveRole()" data-testid="as-save-role">Approve and save</button></div>
        </ng-container>
      </div>

      <div *ngIf="step === 2" data-testid="as-step2">
        <div class="small text-muted mb-2" *ngIf="!sel.jd_approved_on && !roleSaved">Approve the job description first (step 1): the KPIs come from the responsibilities.</div>
        <button class="btn btn-primary btn-sm mb-2" type="button" [disabled]="busy" (click)="draftKpis()" data-testid="as-draft-kpis">{{busy ? 'Thinking...' : 'Draft KPIs with AI'}}</button>
        <div *ngIf="kpiDraft">
          <div class="small text-muted mb-1" *ngIf="kpiDraft.history.measures.length">Targets were set from the last {{kpiDraft.history.months}} months of {{kpiDraft.history.staff}} staff (anonymous).</div>
          <div class="alert alert-info py-1 small" *ngFor="let d of kpiDraft.dropped">{{d}}</div>
          <table class="table table-sm align-middle" data-testid="as-kpis">
            <thead><tr><th>Measure</th><th>How</th><th style="width:7rem">Points</th><th></th></tr></thead>
            <tbody><tr *ngFor="let k of kpiDraft.kpis; let i = index" data-testid="as-kpi">
              <td><input class="form-control form-control-sm mb-1" maxlength="60" [(ngModel)]="k.name"><div class="small text-muted">{{k.why}}</div></td>
              <td><span class="badge" [ngClass]="k.source === 'SYSTEM' ? 'bg-primary' : 'bg-secondary'">{{k.source === 'SYSTEM' ? 'System' : 'Manager rates'}}</span>
                <div class="small">{{k.source === 'SYSTEM' ? ruleText(k) : k.description}}</div></td>
              <td><input type="number" min="1" class="form-control form-control-sm" [(ngModel)]="k.max_points"></td>
              <td class="text-end"><button class="btn btn-outline-danger btn-sm" type="button" (click)="kpiDraft.kpis.splice(i, 1)">Remove</button></td></tr></tbody>
          </table>
          <div class="small text-muted mb-2">Points are scaled to total 100 when added (now {{kpiTotal()}}).</div>
          <button class="btn btn-success btn-sm" type="button" [disabled]="busy || !kpiDraft.kpis.length" (click)="applyKpis()" data-testid="as-apply-kpis">Add these KPIs to {{sel.name}}</button>
        </div>
      </div>

      <div *ngIf="step === 3" data-testid="as-step3">
        <button class="btn btn-primary btn-sm mb-2" type="button" [disabled]="busy" (click)="draftBands()" data-testid="as-draft-bands">{{busy ? 'Thinking...' : 'Draft incentive bands with AI'}}</button>
        <div *ngIf="bandDraft">
          <div class="small text-muted mb-2" *ngIf="rationale">{{rationale}}</div>
          <table class="table table-sm align-middle" data-testid="as-bands">
            <thead><tr><th>Score from %</th><th>Label</th><th>Paid each month (Rs)</th><th></th></tr></thead>
            <tbody><tr *ngFor="let b of bandDraft; let i = index" data-testid="as-band">
              <td><input type="number" min="0" max="100" class="form-control form-control-sm" style="width:6rem" [(ngModel)]="b.min_percent"></td>
              <td><input class="form-control form-control-sm" maxlength="30" [(ngModel)]="b.label"></td>
              <td><input type="number" min="0" class="form-control form-control-sm" style="width:8rem" [(ngModel)]="b.incentive_amount"></td>
              <td class="text-end"><button class="btn btn-outline-danger btn-sm" type="button" (click)="bandDraft.splice(i, 1)">Remove</button></td></tr></tbody>
          </table>
          <button class="btn btn-outline-secondary btn-sm mb-2" type="button" (click)="bandDraft.push({ min_percent: 0, label: '', incentive_amount: 0 })">Add band</button>
          <button class="btn btn-outline-primary btn-sm mb-2 ms-2" type="button" [disabled]="busy" (click)="recheck()" data-testid="as-recheck">Check the cost</button>
          <div class="border rounded p-2 mb-2 small" *ngIf="sim" data-testid="as-cost">
            <div>Role payroll about <strong>Rs {{sim.monthly_payroll | number}}</strong> a month for {{sim.position.staff}} staff.</div>
            <div *ngIf="sim.history.people_months">Over the last {{sim.history.months}} months these bands would have paid about <strong>Rs {{sim.history.monthly_cost | number:'1.0-0'}}</strong> a month in all (average Rs {{sim.history.average_per_person_month | number:'1.0-0'}} per person).</div>
            <div *ngIf="!sim.history.people_months" class="text-muted">No month has been scored for this role yet, so there is no history to replay.</div>
            <div>If everyone reached the top band: <strong>Rs {{sim.worst_case | number}}</strong> a month<span *ngIf="sim.ceiling !== null"> (your ceiling: Rs {{sim.ceiling | number}})</span>.</div>
            <div class="text-danger" *ngIf="sim.over" data-testid="as-over">This is above your ceiling. Lower the amounts, or change the ceiling.</div>
          </div>
          <button class="btn btn-success btn-sm" type="button" [disabled]="busy || (sim && sim.over)" (click)="applyBands()" data-testid="as-apply-bands">Use these bands for {{sel.name}}</button>
          <span class="small text-muted ms-2">Applies to months not yet finalised; finalised months keep what they earned.</span>
        </div>
      </div>

      <div *ngIf="step === 4" data-testid="as-step4">
        <p class="small text-muted">Give each person with a login who holds this role a weekly to-do to look at their KPI, with their measures and targets listed. You also get a monthly to-do to give the ratings only a manager can give. Warnings when someone falls behind pace come from the alert "KPI behind pace" (Settings &gt; Alerts).</p>
        <div class="d-flex align-items-end gap-2">
          <div><label class="form-label mb-0 small">Every</label>
            <select class="form-select form-select-sm" [(ngModel)]="weekday" data-testid="as-weekday"><option *ngFor="let d of days; let i = index" [ngValue]="i">{{d}}</option></select></div>
          <button class="btn btn-primary btn-sm" type="button" [disabled]="busy" (click)="makeTodos()" data-testid="as-todos">Create the reminders</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" (click)="finish()" data-testid="as-next">{{nextRole() ? 'Next role' : 'Done'}}</button>
        </div>
      </div>
    </ng-container>`,
})
export class HrAssistantComponent implements OnInit {
  status: any = null;
  ceiling: number | null = null;
  roles: any[] = [];
  sel: any = null;
  step = 1;
  steps = [{ n: 1, label: "Description" }, { n: 2, label: "KPIs" }, { n: 3, label: "Incentives" }, { n: 4, label: "Reminders" }];
  days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  weekday = 1;
  busy = false;
  message = "";
  error = "";
  notes = "";
  role: any = null;
  roleSaved = false;
  kpiDraft: any = null;
  bandDraft: any[] | null = null;
  rationale = "";
  sim: any = null;
  private measures: { [k: string]: string } = {};

  constructor(private hr: HrService) {}

  ngOnInit() {
    this.hr.get("kpi/system-measures").subscribe((m: any) => { for (const x of m || []) this.measures[x.key] = x.label; }, () => undefined);
    this.load();
  }

  private load() {
    this.hr.get("ai/status").subscribe((s: any) => { this.status = s; this.ceiling = s.ceiling_pct; }, (e) => (this.error = this.hr.msg(e)));
    this.hr.get("ai/roles").subscribe((r: any) => { this.roles = r; if (this.sel) this.sel = r.find((x: any) => x.id === this.sel.id) || this.sel; }, (e) => (this.error = this.hr.msg(e)));
  }

  measureLabel(k: string) { return k === "MANUAL" ? "Manager judges" : (this.measures[k] || k); }
  nextRole() { return this.roles.find((r) => r.staff && (!r.jd_approved_on || !r.measures || !r.bands) && (!this.sel || r.id !== this.sel.id)) || null; }
  openNext() { const r = this.nextRole(); if (r) this.open(r); }

  open(r: any) {
    this.sel = r; this.message = this.error = ""; this.notes = ""; this.kpiDraft = null; this.bandDraft = null; this.sim = null; this.roleSaved = false;
    this.role = r.has_description ? { purpose: r.purpose || "", responsibilities: (r.responsibilities || []).map((x: any) => ({ ...x })) } : null;
    this.step = !r.jd_approved_on ? 1 : !r.measures ? 2 : !r.bands ? 3 : 4;
  }
  close() { this.sel = null; this.load(); }
  finish() { const n = this.nextRole(); this.load(); if (n) this.open(n); else this.close(); }

  private run<T>(call: any, ok: (r: T) => void) {
    this.busy = true; this.message = this.error = "";
    call.subscribe((r: T) => { this.busy = false; ok(r); }, (e: any) => { this.busy = false; this.error = this.hr.msg(e); });
  }

  saveCeiling() {
    this.run(this.hr.put("ai/ceiling", { pct: this.ceiling === null || (this.ceiling as any) === "" ? null : this.ceiling }), (s: any) => { this.status = s; this.message = "Ceiling saved."; });
  }

  draftRole() { this.run(this.hr.post("ai/role/draft", { position_id: this.sel.id, notes: this.notes }), (r: any) => { this.role = r.draft; }); }
  saveRole() {
    this.run(this.hr.post("ai/role/save", { position_id: this.sel.id, purpose: this.role.purpose, responsibilities: this.role.responsibilities.filter((x: any) => x.text.trim()) }),
      () => { this.message = "Job description saved."; this.roleSaved = true; this.sel = { ...this.sel, jd_approved_on: new Date().toISOString() }; this.load(); this.step = 2; });
  }

  draftKpis() { this.run(this.hr.post("ai/kpis/draft", { position_id: this.sel.id }), (r: any) => { this.kpiDraft = r; }); }
  kpiTotal() { return (this.kpiDraft?.kpis || []).reduce((t: number, k: any) => t + (Number(k.max_points) || 0), 0); }
  ruleText(k: any) {
    const r = k.rule; if (!r) return "";
    if (r.kind === "linear") return `full marks at ${r.target}, none at ${r.floor}`;
    return "steps: " + (r.steps || []).map((s: any) => `up to ${s.upto} earns ${s.pct}%`).join(", ") + `, beyond earns ${r.otherwise ?? 0}%`;
  }
  applyKpis() {
    this.run(this.hr.post("ai/kpis/apply", { position_id: this.sel.id, kpis: this.kpiDraft.kpis }), (r: any) => { this.message = `${r.added} KPI measures added.`; this.kpiDraft = null; this.load(); this.step = 3; });
  }

  draftBands() { this.run(this.hr.post("ai/bands/draft", { position_id: this.sel.id }), (r: any) => { this.bandDraft = r.bands; this.rationale = r.rationale; this.sim = r; }); }
  recheck() { this.run(this.hr.post("ai/bands/simulate", { position_id: this.sel.id, bands: this.bandDraft }), (r: any) => { this.bandDraft = r.bands; this.sim = r; }); }
  applyBands() { this.run(this.hr.post("ai/bands/apply", { position_id: this.sel.id, bands: this.bandDraft }), () => { this.message = "Incentive bands saved."; this.bandDraft = null; this.sim = null; this.load(); this.step = 4; }); }

  makeTodos() {
    this.run(this.hr.post("kpi/todos", { position_id: this.sel.id, weekday: this.weekday }), (r: any) => {
      this.message = `${r.created} weekly reminder${r.created === 1 ? "" : "s"} created${r.already ? `, ${r.already} already had one` : ""}${r.rating_todo ? ", and your monthly ratings reminder" : ""}.${r.skipped ? ` ${r.skipped} login${r.skipped === 1 ? " is" : "s are"} not in a store you look after, so ${r.skipped === 1 ? "it was" : "they were"} left out.` : ""}`;
    });
  }
}
