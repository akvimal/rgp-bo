import { Component, OnInit } from "@angular/core";
import { ComplianceItem, ComplianceService, Step } from "./compliance.service";

/**
 * Oversight > Compliance: what is owed in the stores, by step of the ladder (RECOGNITION_AND_COMPLIANCE 3.2). A store head can ask for a waiver and say why;
 * only the Business Head grants one, for a set time, or declines it. Items that are not someone's to do are sent back with "not mine".
 */
@Component({
    selector: 'app-compliance',
    template: `
    <div class="pagetitle"><h1>Compliance</h1><div class="small text-muted">What is owed, and how late it is. The Business Head decides waivers.</div></div>

    <div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Step" data-testid="cr-filters">
      <button type="button" *ngFor="let f of filters" class="btn btn-sm" [ngClass]="step === f.key ? 'btn-primary' : 'btn-outline-secondary'" (click)="step = f.key" [attr.data-testid]="'cr-filter-' + f.key">{{f.label}} {{count(f.key)}}</button>
    </div>

    <div class="alert alert-danger" *ngIf="error">{{error}}</div>
    <div class="alert alert-light" *ngIf="!error && loaded && !shown.length" data-testid="cr-empty">Nothing here. {{step === 'all' ? 'Everything that is owed is done.' : ''}}</div>

    <div class="card" *ngIf="shown.length">
      <div class="table-responsive">
        <table class="table align-middle mb-0" data-testid="cr-table">
          <thead><tr><th>Item</th><th>Store</th><th>Owner</th><th>Due</th><th>Step</th><th>What you can do</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of shown" [attr.data-testid]="'cr-row-' + r.id" [class.table-warning]="r.step === 'late' || r.step === 'escalated'">
              <td><strong>{{r.label}}</strong><div class="small text-muted">{{describe(r)}}</div></td>
              <td>{{r.location}}</td>
              <td>{{r.person_name || ownerLabel(r.owner)}}</td>
              <td>{{r.due_on | date:'d MMM y'}}</td>
              <td><span class="badge" [ngClass]="badge(r.step)">{{stepLabel(r.step)}}</span><span class="badge bg-light text-dark ms-1" *ngIf="r.not_mine">not mine</span></td>
              <td>
                <div class="d-flex flex-wrap gap-1 align-items-center">
                  <button class="btn btn-sm btn-outline-secondary" (click)="open(r)" [attr.data-testid]="'cr-history-' + r.id">History</button>
                  <button class="btn btn-sm btn-outline-secondary" *ngIf="!r.not_mine && r.step !== 'waived'" (click)="notMine(r)" [attr.data-testid]="'cr-notmine-' + r.id">Not mine</button>
                  <button class="btn btn-sm btn-outline-primary" *ngIf="can.request && canWaive(r) && !pending(r)" (click)="asking = r; reason = ''" [attr.data-testid]="'cr-ask-' + r.id">Ask for a waiver</button>
                  <span class="small text-warning fw-semibold" *ngIf="pending(r)">Waiver asked: waiting for the Business Head</span>
                  <span class="small text-muted" *ngIf="r.waiver?.status === 'GRANTED'">Waived until {{r.waiver?.until | date:'d MMM'}}</span>
                  <ng-container *ngIf="can.decide && pending(r)">
                    <button class="btn btn-sm btn-success" (click)="deciding = r; days = 3; note = ''" [attr.data-testid]="'cr-grant-' + r.id">Grant</button>
                    <button class="btn btn-sm btn-outline-danger" (click)="decline(r)" [attr.data-testid]="'cr-decline-' + r.id">Decline</button>
                  </ng-container>
                  <button class="btn btn-sm btn-outline-primary" *ngIf="can.decide && !pending(r) && canWaive(r) && r.waiver?.status !== 'GRANTED'" (click)="deciding = r; days = 3; note = ''" [attr.data-testid]="'cr-waive-' + r.id">Waive</button>
                </div>
                <div class="small text-muted mt-1" *ngIf="pending(r)">“{{r.waiver?.reason}}”</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card mt-3" *ngIf="asking" data-testid="cr-ask-form"><div class="card-body">
      <h2 class="h6">Ask for a waiver: {{asking.label}}</h2>
      <div class="small text-muted mb-2">Say why. Only the Business Head can grant it, for a set number of days.</div>
      <input class="form-control mb-2" [(ngModel)]="reason" maxlength="300" placeholder="Why is it needed?" aria-label="Reason" data-testid="cr-ask-reason">
      <button class="btn btn-primary btn-sm me-2" (click)="sendAsk()" [disabled]="reason.trim().length < 3" data-testid="cr-ask-send">Send</button>
      <button class="btn btn-outline-secondary btn-sm" (click)="asking = null">Cancel</button>
    </div></div>

    <div class="card mt-3" *ngIf="deciding" data-testid="cr-grant-form"><div class="card-body">
      <h2 class="h6">Waive: {{deciding.label}}</h2>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
        <label class="small">For</label><input type="number" min="1" class="form-control form-control-sm" style="width:90px" [(ngModel)]="days" aria-label="Days" data-testid="cr-grant-days"><span class="small">days (longest {{maxDays}})</span>
      </div>
      <input class="form-control mb-2" [(ngModel)]="note" maxlength="300" placeholder="Reason, kept on record" aria-label="Reason" data-testid="cr-grant-note">
      <button class="btn btn-success btn-sm me-2" (click)="sendGrant()" data-testid="cr-grant-send">Grant the waiver</button>
      <button class="btn btn-outline-secondary btn-sm" (click)="deciding = null">Cancel</button>
    </div></div>

    <div class="card mt-3" *ngIf="history" data-testid="cr-history"><div class="card-body">
      <h2 class="h6">History: {{history.item.label}}</h2>
      <div class="small" *ngFor="let e of history.rows">{{e.at}} · {{e.kind.replace('_', ' ')}}<span *ngIf="e.note"> · {{e.note}}</span><span *ngIf="e.actor"> · {{e.actor}}</span></div>
      <button class="btn btn-outline-secondary btn-sm mt-2" (click)="history = null">Close</button>
    </div></div>
    <div class="alert alert-info mt-3 py-2" *ngIf="message" role="status">{{message}}</div>`
})
export class ComplianceComponent implements OnInit {
    items: ComplianceItem[] = [];
    can = { request: false, decide: false };
    maxDays = 7;
    step: 'all' | Step = 'all';
    loaded = false;
    error = '';
    message = '';
    asking: ComplianceItem | null = null;
    deciding: ComplianceItem | null = null;
    history: { item: ComplianceItem; rows: any[] } | null = null;
    reason = '';
    note = '';
    days = 3;

    filters: { key: 'all' | Step; label: string }[] = [
        { key: 'all', label: 'All' }, { key: 'escalated', label: 'Escalated' }, { key: 'late', label: 'Late' },
        { key: 'due', label: 'Due' }, { key: 'reminder', label: 'Reminder' }, { key: 'waived', label: 'Waived' },
    ];

    constructor(private service: ComplianceService) {}

    ngOnInit() { this.load(); }

    load() {
        this.service.summary().subscribe({ next: (s) => (this.can = s.can), error: () => {} });
        this.service.store().subscribe({
            next: (rows) => { this.items = rows; this.loaded = true; },
            error: (e) => { this.loaded = true; this.error = e?.error?.message || 'Unable to load the register'; },
        });
    }

    get shown(): ComplianceItem[] { return this.items.filter((r) => this.step === 'all' || r.step === this.step); }
    count(k: 'all' | Step): number { return k === 'all' ? this.items.length : this.items.filter((r) => r.step === k).length; }
    pending(r: ComplianceItem): boolean { return r.waiver?.status === 'REQUESTED'; }
    canWaive(r: ComplianceItem): boolean { return r.step !== 'reminder' && r.step !== 'done'; }
    ownerLabel(o: string): string { return o === 'owner' ? 'Business Head' : o === 'store_head' ? 'Store head' : 'Person on duty'; }
    stepLabel(s: Step): string { return s.charAt(0).toUpperCase() + s.slice(1); }
    badge(s: Step): string { return ({ reminder: 'bg-info text-dark', due: 'bg-primary', late: 'bg-warning text-dark', escalated: 'bg-danger', waived: 'bg-secondary', done: 'bg-success' } as any)[s]; }

    describe(r: ComplianceItem): string {
        const d = r.detail || {};
        switch (r.item_key) {
            case 'stock_count': return d.last ? `Last count ${d.last}` : 'No count yet';
            case 'outage_check': return d.last ? `Last check ${d.last}` : 'Not checked yet';
            case 'weekly_review': return `Week of ${d.week}`;
            case 'licence': return `${String(d.type || '').replace(/_/g, ' ')} ${d.number || ''} ends ${d.valid_to}`;
            case 'shift_close': return `${d.shift || 'Shift'} of ${d.day} is still open`;
            case 'parked_bill': return `Bill ${d.bill} from ${d.day}`;
            default: return '';
        }
    }

    private done(m: string) { this.message = m; this.asking = null; this.deciding = null; this.load(); }
    private fail(e: any) { this.error = e?.error?.message || 'That did not work'; }

    notMine(r: ComplianceItem) { this.service.notMine(r.id).subscribe({ next: () => this.done('Sent to your store head as not yours.'), error: (e) => this.fail(e) }); }
    sendAsk() { if (!this.asking) return; this.service.requestWaiver(this.asking.id, this.reason.trim()).subscribe({ next: () => this.done('Asked. The Business Head has been told.'), error: (e) => this.fail(e) }); }
    sendGrant() { if (!this.deciding) return; this.service.grantWaiver(this.deciding.id, Number(this.days), this.note.trim() || undefined).subscribe({ next: () => this.done('Waiver granted.'), error: (e) => this.fail(e) }); }
    decline(r: ComplianceItem) { this.service.declineWaiver(r.id).subscribe({ next: () => this.done('Request declined.'), error: (e) => this.fail(e) }); }
    open(r: ComplianceItem) { this.service.events(r.id).subscribe({ next: (rows) => (this.history = { item: r, rows }), error: (e) => this.fail(e) }); }
}
