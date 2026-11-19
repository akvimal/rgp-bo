import { Component, Input, OnInit } from "@angular/core";
import { forkJoin } from "rxjs";
import { CustomersService } from "../customers/customers.service";

/** the Indian day as YYYY-MM-DD, `back` days before today */
export function istDay(back = 0): string {
    return new Date(Date.now() + 330 * 60000 - back * 86400000).toISOString().slice(0, 10);
}

/**
 * Turnaround scorecard (docs/planning/REFILL_CRM_DASHBOARD.md, step 3): of the customers contacted in the last 7 days, how many bought again within the
 * window, against the 7 days before. A person sees their own; a manager sees the team and can change the windows. Counts sit beside every percentage:
 * a few contacts swing it.
 */
@Component({
    selector: 'app-turnaround-card',
    template: `
    <section class="card h-100" aria-label="Did they come back" data-testid="ta-card">
      <div class="card-body">
        <h2 class="h6 mb-1">{{team ? 'Did contacted customers come back?' : (shared ? 'Did the customers we contacted come back?' : 'Did the customers you contacted come back?')}}</h2>
        <div class="small text-muted mb-2">Last 7 days, against the 7 days before. A contact counts when the customer buys again within {{windows?.refillDays || 7}} days (a refill reminder: a regular medicine) or {{windows?.lapsedDays || 14}} days (any other reason).</div>
        <div class="text-muted" *ngIf="!week && !error">Loading...</div>
        <div class="alert alert-danger py-2" *ngIf="error" data-testid="ta-error">{{error}}</div>
        <ng-container *ngIf="week as w">
          <div class="row g-2 text-center">
            <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="fs-4 fw-bold" data-testid="ta-contacts">{{w.totals.contacts}}</div><div class="small text-muted">contacts made</div><div class="small text-muted" *ngIf="prev">{{prev.totals.contacts}} before</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="fs-4 fw-bold text-success" data-testid="ta-back">{{w.totals.cameBack}}<span class="fs-6 fw-normal text-muted" *ngIf="w.totals.ratePct !== null"> · {{w.totals.ratePct}}%</span></div><div class="small text-muted">came back</div><div class="small text-muted" *ngIf="prev">{{prev.totals.cameBack}}<span *ngIf="prev.totals.ratePct !== null"> · {{prev.totals.ratePct}}%</span> before</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="fs-4 fw-bold" data-testid="ta-days">{{w.totals.medianDays !== null ? (w.totals.medianDays | number:'1.0-1') + ' d' : '-'}}</div><div class="small text-muted">usual days to return</div></div></div>
            <div class="col-6 col-md-3"><div class="border rounded p-2 h-100"><div class="fs-4 fw-bold" data-testid="ta-value">₹{{w.totals.value | number:'1.0-0'}}</div><div class="small text-muted">sales from those who came back</div></div></div>
          </div>
          <div class="small mt-2">
            <span class="badge bg-warning text-dark me-1" data-testid="ta-waiting">{{w.totals.waiting}} still waiting</span>
            <span class="badge bg-secondary me-1" data-testid="ta-lapsed">{{w.totals.lapsed}} did not come back</span>
            <span class="text-muted" *ngIf="w.totals.notCounted">{{w.totals.notCounted}} attempt{{w.totals.notCounted === 1 ? '' : 's'}} not counted (no answer, wrong number, dues).</span>
          </div>
          <div class="small text-muted mt-1" *ngIf="w.totals.cameBack + w.totals.lapsed < 5" data-testid="ta-few">Too few contacts decided yet to read much into the percentage.</div>

          <div class="table-responsive mt-3" *ngIf="w.byPerson?.length" data-testid="ta-people">
            <table class="table table-sm mb-0">
              <thead><tr><th>Person</th><th class="text-end">Contacts</th><th class="text-end">Came back</th><th class="text-end">Waiting</th><th class="text-end">Did not</th><th class="text-end">Days</th></tr></thead>
              <tbody><tr *ngFor="let p of w.byPerson"><td>{{p.name || 'Someone'}}</td><td class="text-end">{{p.contacts}}</td><td class="text-end">{{p.cameBack}}<span class="text-muted" *ngIf="p.ratePct !== null"> ({{p.ratePct}}%)</span></td><td class="text-end">{{p.waiting}}</td><td class="text-end">{{p.lapsed}}</td><td class="text-end">{{p.medianDays !== null ? (p.medianDays | number:'1.0-1') : '-'}}</td></tr></tbody>
            </table>
            <div class="small text-muted">Not a league table: who called when depends on the lists each person was given.</div>
          </div>

          <div class="border rounded p-2 mt-3" *ngIf="canSetWindows && edit" data-testid="ta-windows">
            <div class="small fw-semibold mb-1">How long a customer has to come back</div>
            <div class="d-flex flex-wrap align-items-end gap-2">
              <div><label class="form-label small mb-0" for="ta-w-refill">Refill reminders (days)</label><input id="ta-w-refill" type="number" min="1" max="60" class="form-control form-control-sm" style="width:6rem" [(ngModel)]="edit.refillDays" data-testid="ta-w-refill"></div>
              <div><label class="form-label small mb-0" for="ta-w-other">Other contacts (days)</label><input id="ta-w-other" type="number" min="1" max="90" class="form-control form-control-sm" style="width:6rem" [(ngModel)]="edit.lapsedDays" data-testid="ta-w-other"></div>
              <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="saving || !changed" (click)="save()" data-testid="ta-w-save">Save</button>
              <span class="small text-success" *ngIf="saved">Saved.</span>
            </div>
          </div>
        </ng-container>
      </div>
    </section>`
})
export class TurnaroundCardComponent implements OnInit {
    /** a manager may change the windows */
    @Input() canSetWindows = false;
    /** a shared counter login: the wording is the counter's */
    @Input() shared = false;
    week: any = null;
    prev: any = null;
    error = '';
    edit: { refillDays: number; lapsedDays: number } | null = null;
    saving = false;
    saved = false;

    constructor(private customers: CustomersService) {}

    get team(): boolean { return this.week?.scope === 'team'; }
    get windows() { return this.week?.windows; }
    get changed(): boolean { return !!this.edit && !!this.windows && (this.edit.refillDays !== this.windows.refillDays || this.edit.lapsedDays !== this.windows.lapsedDays); }

    ngOnInit() { this.load(); }

    load() {
        this.error = '';
        forkJoin({
            week: this.customers.turnaround({ from: istDay(6), to: istDay(0) }),
            prev: this.customers.turnaround({ from: istDay(13), to: istDay(7) }),
        }).subscribe({
            next: (r) => { this.week = r.week; this.prev = r.prev; this.edit = { refillDays: r.week.windows.refillDays, lapsedDays: r.week.windows.lapsedDays }; },
            error: (e) => { this.error = e?.error?.message || 'The scorecard could not be loaded.'; },
        });
    }

    save() {
        if (!this.edit) return;
        this.saving = true; this.saved = false; this.error = '';
        this.customers.saveRelSettings({ turnaroundRefillDays: Number(this.edit.refillDays), turnaroundLapsedDays: Number(this.edit.lapsedDays) }).subscribe({
            next: () => { this.saving = false; this.saved = true; this.load(); },
            error: (e) => { this.saving = false; const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(' ') : (m || 'The windows could not be saved.'); },
        });
    }
}
