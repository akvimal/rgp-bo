import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";
import { ConfigItem, ConfigScope, ConfigService } from "../../../shared/config.service";
import { DashboardService } from "../../dashboard.service";

const TABS: { scope: ConfigScope; label: string; help: string }[] = [
  { scope: 'views', label: 'Views', help: 'How the dashboards open and which menu people see.' },
  { scope: 'recognition', label: 'Goals and badges', help: 'The habits that earn a badge, and how much of each is needed. Badges measure habits, never raw sales or discount depth.' },
  { scope: 'compliance', label: 'Compliance', help: 'When an item that is owed becomes late, needs a reason to carry on, or is told to the Business Head. Items the law requires are shown and cannot be changed.' },
  { scope: 'health', label: 'Health and targets', help: 'How the seven store checks are weighted, and the monthly sales target. The weights must add up to 100. One weak check always holds the store at Watch.' },
  { scope: 'words', label: 'Wording', help: 'What your business calls things on screen.' },
];

const ROLES = ['Business Head', 'Owner-operator', 'Store Head', 'Sales Staff', 'Counter', 'Personal'];

/**
 * Settings > Dashboards and compliance (RECOGNITION_AND_COMPLIANCE 10.3, implementation plan stage 7). One tab per group of settings, the default beside the
 * business's choice with a reset, plan locks and legal locks shown as such, a start date for a change, and who changed what. The Business Head saves; the
 * Store Head reads the same screen without controls. The server decides every limit; this screen only shows them.
 */
@Component({
    selector: 'app2-dashboard-setup',
    template: `
    <div class="container-fluid" data-testid="dsetup">
      <h1 class="h4 mb-1">Dashboards and compliance</h1>
      <p class="text-muted small mb-3" *ngIf="!canEdit && loaded" data-testid="dsetup-readonly">You can read these settings but not change them: only the Business Head does.</p>
      <ul class="nav nav-tabs mb-3" role="tablist">
        <li class="nav-item" *ngFor="let t of tabs"><button class="nav-link" [class.active]="t.scope === tab" role="tab" (click)="open(t.scope)" [attr.data-testid]="'dsetup-tab-' + t.scope">{{t.label}}</button></li>
      </ul>
      <p class="small text-muted">{{current.help}}</p>

      <div class="alert alert-danger" *ngIf="error" role="alert" data-testid="dsetup-error">{{error}}</div>
      <div class="alert alert-success" *ngIf="message" role="status" data-testid="dsetup-message">{{message}}</div>

      <div class="card mb-3"><div class="card-body p-0">
        <div class="row g-0 border-bottom p-2 small fw-semibold text-muted d-none d-md-flex"><div class="col-md-5">Setting</div><div class="col-md-3">Your choice</div><div class="col-md-2">Default</div><div class="col-md-2"></div></div>
        <div class="row g-0 border-bottom p-2 align-items-center" *ngFor="let i of items" [attr.data-testid]="'dsetup-row-' + i.key">
          <div class="col-md-5">
            <label [attr.for]="'f-' + i.key" class="mb-0">{{i.label}}</label>
            <div class="small text-muted" *ngIf="i.locked"><i class="bi bi-lock"></i> Required: cannot be changed.</div>
            <div class="small text-muted" *ngIf="i.planLocked && !i.locked"><i class="bi bi-lock"></i> Not changeable on your plan.</div>
            <div class="small text-muted" *ngIf="i.source === 'business' && i.since">Set from {{i.since}}</div>
            <div class="small text-primary" *ngIf="i.pending" [attr.data-testid]="'dsetup-pending-' + i.key">Changes to {{show(i.pending.value, i)}} from {{i.pending.from}}</div>
          </div>
          <div class="col-md-3">
            <ng-container [ngSwitch]="i.kind">
              <input *ngSwitchCase="'int'" type="number" class="form-control form-control-sm" [id]="'f-' + i.key" [min]="i.min" [max]="i.max" [step]="i.step || 1" [(ngModel)]="draft[i.key]" [disabled]="!editable(i)" [attr.data-testid]="'dsetup-input-' + i.key">
              <select *ngSwitchCase="'enum'" class="form-select form-select-sm" [id]="'f-' + i.key" [(ngModel)]="draft[i.key]" [disabled]="!editable(i)" [attr.data-testid]="'dsetup-input-' + i.key">
                <option *ngFor="let o of i.options" [ngValue]="o">{{o}}</option>
              </select>
              <div *ngSwitchCase="'bool'" class="form-check form-switch"><input type="checkbox" class="form-check-input" [id]="'f-' + i.key" [(ngModel)]="draft[i.key]" [disabled]="!editable(i)" [attr.data-testid]="'dsetup-input-' + i.key"></div>
            </ng-container>
            <div class="small text-muted" *ngIf="i.kind === 'int' && (i.min !== undefined || i.max !== undefined)">{{i.min}} to {{i.max}} {{i.unit}}</div>
          </div>
          <div class="col-md-2 small text-muted">{{show(i.defaultValue, i)}}</div>
          <div class="col-md-2 text-md-end">
            <button class="btn btn-sm btn-outline-secondary" *ngIf="canEdit && (i.source === 'business' || i.pending) && !i.planLocked && !i.locked" (click)="resetOne(i)" [attr.data-testid]="'dsetup-reset-' + i.key">Reset to default</button>
          </div>
        </div>
        <div class="p-3 text-muted" *ngIf="loaded && !items.length">Nothing to set in this group for your business.</div>
      </div></div>

      <div class="alert alert-warning py-2" *ngIf="tab === 'health' && weightTotal !== 100" data-testid="dsetup-weights">The weights add up to {{weightTotal}}; they must add up to 100.</div>

      <div class="d-flex flex-wrap gap-2 align-items-end mb-4" *ngIf="canEdit">
        <div>
          <label class="form-label small mb-0" for="dsetup-from">Takes effect from</label>
          <input id="dsetup-from" type="date" class="form-control form-control-sm" [(ngModel)]="from" [min]="today" [max]="latest" data-testid="dsetup-from">
        </div>
        <button class="btn btn-primary btn-sm" (click)="save()" [disabled]="saving || !dirty" data-testid="dsetup-save">Save changes</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="resetAll()" *ngIf="hasOwn" data-testid="dsetup-reset-all">Reset this tab to the defaults</button>
        <span class="small text-muted">A change starts on the date shown, so nothing already late is judged again.</span>
      </div>

      <section class="card mb-3" *ngIf="tab === 'views' && canEdit" aria-label="Preview as a role" data-testid="dsetup-preview">
        <div class="card-body">
          <h2 class="h6">Preview as a role <span class="text-muted fw-normal small">with the changes above, before you save</span></h2>
          <div class="d-flex gap-2 align-items-center mb-2">
            <select class="form-select form-select-sm" style="max-width: 14rem" [(ngModel)]="previewRole" aria-label="Role to preview" data-testid="dsetup-preview-role"><option *ngFor="let r of roles" [ngValue]="r">{{r}}</option></select>
            <button class="btn btn-outline-primary btn-sm" (click)="runPreview()" data-testid="dsetup-preview-go">Preview</button>
          </div>
          <div *ngIf="preview" data-testid="dsetup-preview-result">
            <div class="small">{{preview.role}} opens the <strong>{{preview.view}}</strong> view with: <span class="badge bg-light text-dark border me-1" *ngFor="let w of preview.widgets">{{w}}</span></div>
            <div class="small text-muted mt-1">Sales figures {{preview.settings.amounts}}; opens on {{preview.settings.default_period}}; {{preview.settings.new_menu ? 'grouped menu' : 'long-standing menu'}}.</div>
          </div>
        </div>
      </section>

      <section class="card mb-3" *ngIf="tab === 'health'" aria-label="Sales targets" data-testid="dsetup-targets">
        <div class="card-body">
          <h2 class="h6">Sales target for {{targets?.month}} <span class="text-muted fw-normal small">a store with no target of its own uses the business target</span></h2>
          <div class="row g-2 align-items-center mb-1">
            <div class="col-md-4">Whole business</div>
            <div class="col-md-4"><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="targetBusiness" [disabled]="!canEdit" aria-label="Business sales target" data-testid="dsetup-target-business"></div>
          </div>
          <div class="row g-2 align-items-center mb-1" *ngFor="let s of targets?.stores">
            <div class="col-md-4">{{s.location}}</div>
            <div class="col-md-4"><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="targetStores[s.id]" [disabled]="!canEdit" [attr.aria-label]="'Sales target for ' + s.location" [attr.data-testid]="'dsetup-target-' + s.id"></div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center mt-2" *ngIf="canEdit">
            <button class="btn btn-outline-primary btn-sm" (click)="saveTargets()" data-testid="dsetup-target-save">Save targets</button>
            <span class="text-muted small ms-2">No target in mind?</span>
            <div class="input-group input-group-sm" style="max-width: 11rem"><span class="input-group-text">Growth</span><input type="number" class="form-control" [(ngModel)]="growth" min="-50" max="100" aria-label="Growth on last year, in percent" data-testid="dsetup-growth"><span class="input-group-text">%</span></div>
            <button class="btn btn-outline-secondary btn-sm" (click)="suggest()" data-testid="dsetup-suggest">Suggest from history</button>
          </div>
          <div class="small text-muted mt-1" *ngIf="suggestNote" data-testid="dsetup-suggest-note">{{suggestNote}}</div>
        </div>
      </section>

      <section class="card" aria-label="Changes" data-testid="dsetup-history">
        <div class="card-body">
          <h2 class="h6">Who changed what</h2>
          <div class="text-muted small" *ngIf="!history.length">No changes yet.</div>
          <div class="small border-bottom py-1" *ngFor="let h of history"><span class="text-muted">{{h.at}}</span> &middot; <strong>{{h.who}}</strong> &middot; {{h.summary}}
            <div class="text-muted" *ngFor="let c of changesOf(h)">{{c}}</div></div>
        </div>
      </section>
    </div>`
})
export class DashboardSetupComponent implements OnInit {
    tabs = TABS;
    roles = ROLES;
    tab: ConfigScope = 'views';
    items: ConfigItem[] = [];
    draft: { [k: string]: any } = {};
    canEdit = false;
    loaded = false;
    saving = false;
    error = '';
    message = '';
    history: any[] = [];
    today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    latest = new Date(Date.now() + 5.5 * 3600000 + 90 * 86400000).toISOString().slice(0, 10);
    from = new Date(Date.now() + 5.5 * 3600000 + 86400000).toISOString().slice(0, 10);
    previewRole = 'Counter';
    preview: any = null;
    targets: any = null;
    targetBusiness: number | null = null;
    targetStores: { [id: number]: number | null } = {};
    growth = 5;
    suggestNote = '';

    constructor(private config: ConfigService, private dashboard: DashboardService, private http: HttpClient) {}

    get current() { return TABS.find((t) => t.scope === this.tab)!; }
    get hasOwn(): boolean { return this.items.some((i) => (i.source === 'business' || !!i.pending) && !i.planLocked && !i.locked); }
    get dirty(): boolean { return this.items.some((i) => this.editable(i) && this.draft[i.key] !== i.value); }
    get weightTotal(): number { return this.items.filter((i) => i.key.startsWith('w_')).reduce((a, i) => a + (Number(this.draft[i.key]) || 0), 0); }

    ngOnInit() { this.open('views'); }

    editable(i: ConfigItem): boolean { return this.canEdit && !i.locked && !i.planLocked; }
    show(v: any, i: ConfigItem): string { return i.kind === 'bool' ? (v ? 'On' : 'Off') : `${v}${i.unit ? ' ' + i.unit : ''}`; }

    open(scope: ConfigScope) {
        this.tab = scope; this.error = ''; this.message = ''; this.preview = null;
        this.config.effective(scope).subscribe({
            next: (r) => { this.items = r.items; this.canEdit = r.canEdit; this.loaded = true; this.draft = {}; r.items.forEach((i) => (this.draft[i.key] = i.value)); },
            error: (e) => { this.loaded = true; this.error = e?.error?.message || 'The settings could not be loaded.'; }
        });
        this.loadHistory();
        if (scope === 'health') this.loadTargets();
    }

    private loadHistory() {
        this.http.get<any[]>(`${environment.apiHost}/config/history`, { params: { scope: this.tab } }).subscribe({ next: (h) => (this.history = h), error: () => (this.history = []) });
    }

    changesOf(h: any): string[] {
        const list = h?.details?.changes;
        return Array.isArray(list) ? list.map((c: any) => `${c.key}: ${c.before} to ${c.after}`) : [];
    }

    save() {
        const values: { [k: string]: any } = {};
        this.items.filter((i) => this.editable(i) && this.draft[i.key] !== i.value).forEach((i) => (values[i.key] = this.draft[i.key]));
        if (!Object.keys(values).length) return;
        this.saving = true; this.error = ''; this.message = '';
        this.config.save(this.tab, values, this.from).subscribe({
            next: (r: any) => { this.saving = false; this.message = `Saved: ${r.changed} setting(s) change from ${r.effectiveFrom}.`; this.open(this.tab); this.message = `Saved: ${r.changed} setting(s) change from ${r.effectiveFrom}.`; },
            error: (e) => { this.saving = false; this.error = e?.error?.message || 'The settings could not be saved.'; }
        });
    }

    resetOne(i: ConfigItem) {
        this.config.reset(this.tab, i.key).subscribe({ next: () => { this.open(this.tab); this.message = `"${i.label}" is back to its default.`; }, error: (e) => (this.error = e?.error?.message || 'Could not reset.') });
    }

    resetAll() {
        this.config.reset(this.tab).subscribe({ next: () => { this.open(this.tab); this.message = 'This tab is back to the defaults.'; }, error: (e) => (this.error = e?.error?.message || 'Could not reset.') });
    }

    runPreview() {
        const values: { [k: string]: any } = {};
        this.items.filter((i) => this.draft[i.key] !== i.value).forEach((i) => (values[i.key] = this.draft[i.key]));
        this.http.post(`${environment.apiHost}/dashboard/preview`, { role: this.previewRole, values }).subscribe({ next: (p) => { this.preview = p; this.error = ''; }, error: (e) => (this.error = e?.error?.message || 'The preview could not be made.') });
    }

    private loadTargets() {
        this.dashboard.getTargets().subscribe({
            next: (t: any) => { this.targets = t; this.targetBusiness = t.business; this.targetStores = {}; (t.stores || []).forEach((s: any) => (this.targetStores[s.id] = s.value)); },
            error: () => (this.targets = null)
        });
    }

    /** fills the boxes from last year's same month (or the recent average) plus the growth chosen; nothing is saved until Save targets */
    suggest() {
        this.error = ''; this.suggestNote = '';
        this.dashboard.suggestTargets(this.targets?.month, Number(this.growth) || 0).subscribe({
            next: (r: any) => {
                if (r.business?.value !== null && r.business?.value !== undefined) this.targetBusiness = r.business.value;
                (r.stores || []).forEach((s: any) => { if (s.value !== null && s.value !== undefined) this.targetStores[s.id] = s.value; });
                const basis = r.business?.basis === 'same month last year' ? "the same month last year" : r.business?.basis === 'recent average' ? 'the recent monthly average' : null;
                this.suggestNote = basis ? `Suggested from ${basis} plus ${r.growth}%. Check the figures, then press Save targets.` : 'There is not enough sales history to suggest a target yet.';
            },
            error: (e) => (this.error = e?.error?.message || 'A target could not be suggested.')
        });
    }

    saveTargets() {
        const month = this.targets?.month;
        if (!month) return;
        const calls = [{ month, storeid: null, value: this.targetBusiness }, ...Object.keys(this.targetStores).map((id) => ({ month, storeid: Number(id), value: this.targetStores[Number(id)] }))];
        const norm = (v: any) => (v === null || v === undefined || (v as any) === '' ? null : Number(v));
        const changed = calls.filter((c) => norm(c.value) !== (c.storeid === null ? this.targets.business : this.targets.stores.find((s: any) => s.id === c.storeid)?.value ?? null));
        if (!changed.length) { this.message = 'No target changed.'; return; }
        let left = changed.length; this.error = ''; this.message = '';
        changed.forEach((c) => this.dashboard.setTarget({ month: c.month, storeid: c.storeid, value: norm(c.value) }).subscribe({
            next: () => { if (--left === 0) { this.message = 'Targets saved.'; this.loadTargets(); this.loadHistory(); } },
            error: (e) => { this.error = e?.error?.message || 'A target could not be saved.'; }
        }));
    }
}
