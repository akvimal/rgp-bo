import { Component, Input, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { CustomersService } from "../customers/customers.service";
import { CommitmentsService } from "../commitments/commitments.service";
import { istDay } from "./turnaround-card.component";

/**
 * My work: the follow-up half of a sales person's day (docs/planning/REFILL_CRM_DASHBOARD.md, step 3). Who to call today, who was contacted and has not
 * come back yet, what was promised to customers, and the regulars no reminder can reach. Every list is short and links to where the work is done; a
 * widget the role may not read simply stays out. Customer names only, never a mobile number: numbers are shown (and counted) on the contact list.
 */
@Component({
    selector: 'app-my-work',
    template: `
    <section aria-label="My work" data-testid="mw">
      <div class="row g-3 mb-3">
        <div class="col-lg-6" *ngIf="call as c">
          <section class="card h-100" aria-label="Call today" data-testid="mw-call">
            <div class="card-body">
              <h3 class="h6">Call today <span class="text-muted fw-normal small">{{c.total}} to contact</span></h3>
              <div class="small mb-2" data-testid="mw-call-counts"><span class="badge bg-light text-dark border me-1" *ngFor="let k of c.counts">{{k.label}} {{k.n}}</span></div>
              <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-1" *ngFor="let r of c.top" data-testid="mw-call-row">
                <div><span class="fw-semibold">{{r.name || 'Customer'}}</span> <span class="badge bg-info text-dark ms-1" *ngIf="r.audience === 'due_back'">Refill due</span><div class="small text-muted">{{r.audienceLabel}} · {{r.reason}}</div></div>
              </div>
              <div class="text-success fw-semibold py-2" *ngIf="!c.total" data-testid="mw-call-none">Nobody to contact today. Well done.</div>
              <a class="btn btn-sm btn-primary mt-2" [routerLink]="['/secure/customers/cust/worklist']" data-testid="mw-call-open">Open the contact list</a>
              <a class="btn btn-sm btn-outline-secondary mt-2 ms-1" [routerLink]="['/secure/quality/refills']" data-testid="mw-refills-open">Refills</a>
            </div>
          </section>
        </div>

        <div class="col-lg-6" *ngIf="back as b">
          <section class="card h-100" aria-label="Waiting to come back" data-testid="mw-waiting">
            <div class="card-body">
              <h3 class="h6">Waiting to come back <span class="text-muted fw-normal small">{{b.waiting.length}} contacted, not bought yet</span></h3>
              <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-1" *ngFor="let r of b.waiting" data-testid="mw-waiting-row">
                <div><span class="fw-semibold">{{r.customer}}</span><div class="small text-muted">{{r.audience === 'due_back' ? 'Refill reminder' : 'Contacted'}} {{r.contacted_on | date:'d MMM'}}</div></div>
                <span class="badge" [ngClass]="r.days_left <= 2 ? 'bg-warning text-dark' : 'bg-light text-dark border'">{{r.days_left}} day{{r.days_left === 1 ? '' : 's'}} left</span>
              </div>
              <div class="text-muted small py-2" *ngIf="!b.waiting.length" data-testid="mw-waiting-none">Nobody is waiting on you.</div>
              <h3 class="h6 mt-3" *ngIf="b.lapsed.length">Did not come back <span class="text-muted fw-normal small">worth another try or a note</span></h3>
              <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-1" *ngFor="let r of b.lapsed" data-testid="mw-lapsed-row">
                <div><span class="fw-semibold">{{r.customer}}</span><div class="small text-muted">Contacted {{r.contacted_on | date:'d MMM'}} · {{r.window_days}} days passed</div></div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-lg-6"><app-turnaround-card [shared]="shared" [canSetWindows]="canSetWindows"></app-turnaround-card></div>
        <div class="col-lg-6">
          <div class="row g-3">
            <div class="col-12" *ngIf="promised as p">
              <section class="card" aria-label="Promised to customers" data-testid="mw-promised">
                <div class="card-body">
                  <h3 class="h6">Promised to customers</h3>
                  <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-1" *ngFor="let o of p.arrived" data-testid="mw-promised-row">
                    <div><span class="fw-semibold">{{o.customer}}</span><div class="small text-muted">Order arrived: {{o.items}}</div></div>
                    <span class="badge bg-danger">tell them</span>
                  </div>
                  <div class="small mb-1" *ngIf="p.holdEnding.length" data-testid="mw-hold-ending"><span class="badge bg-warning text-dark me-1">{{p.holdEnding.length}}</span> order{{p.holdEnding.length === 1 ? '' : 's'}} held for a customer {{p.holdEnding.length === 1 ? 'ends' : 'end'}} within 2 days.</div>
                  <div class="small mb-1" *ngIf="p.overdueInquiries" data-testid="mw-inquiries"><span class="badge bg-danger me-1">{{p.overdueInquiries}}</span> inquiry follow-up{{p.overdueInquiries === 1 ? ' is' : 's are'}} overdue.</div>
                  <div class="text-success small py-1" *ngIf="!p.arrived.length && !p.holdEnding.length && !p.overdueInquiries" data-testid="mw-promised-none">Nothing is waiting on a promise.</div>
                  <a class="btn btn-sm btn-outline-secondary mt-1" [routerLink]="['/secure/commitments']" *ngIf="p.showOrders">Customer orders</a>
                  <a class="btn btn-sm btn-outline-secondary mt-1 ms-1" [routerLink]="['/secure/inquiries']" *ngIf="p.showInquiries">Inquiries</a>
                </div>
              </section>
            </div>
            <div class="col-12" *ngIf="reach as r">
              <section class="card" aria-label="Cannot reach" data-testid="mw-reach">
                <div class="card-body">
                  <h3 class="h6">Regulars we cannot reach <span class="text-muted fw-normal small">{{r.total}} with no mobile number</span></h3>
                  <div class="small text-muted mb-1">Ask for a number at the counter, so their reminders can reach them.</div>
                  <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-1" *ngFor="let c of r.rows.slice(0, 5)" data-testid="mw-reach-row">
                    <div><span class="fw-semibold">{{c.name || 'Customer'}}</span><div class="small text-muted">{{c.visits}} visits this year<span *ngIf="c.locality"> · {{c.locality}}</span></div></div>
                    <a class="btn btn-sm btn-outline-primary" [routerLink]="['/secure/customers/cust/edit', c.id]">Add number</a>
                  </div>
                  <div class="text-success small py-1" *ngIf="!r.total" data-testid="mw-reach-none">Every regular customer has a number.</div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>`
})
export class MyWorkComponent implements OnInit {
    /** a shared counter login: the wording is the counter's */
    @Input() shared = false;
    /** the owner may change the return windows on the scorecard */
    @Input() canSetWindows = false;
    call: { total: number; counts: { label: string; n: number }[]; top: any[] } | null = null;
    back: { waiting: any[]; lapsed: any[] } | null = null;
    promised: { arrived: any[]; holdEnding: any[]; overdueInquiries: number; showOrders: boolean; showInquiries: boolean } | null = null;
    reach: { total: number; rows: any[] } | null = null;

    constructor(private customers: CustomersService, private commitments: CommitmentsService, private http: HttpClient) {}

    ngOnInit() {
        // each widget loads on its own and stays out when the role may not read it
        this.customers.worklist().subscribe({ next: (r) => this.call = this.shapeCall(r), error: () => {} });
        this.customers.turnaround({ from: istDay(29), to: istDay(0) }).subscribe({ next: (r) => this.back = this.shapeBack(r), error: () => {} });
        this.customers.cannotReach().subscribe({ next: (r) => this.reach = r, error: () => {} });
        this.loadPromised();
    }

    private shapeCall(r: any) {
        const rows: any[] = r?.rows || r?.items || r?.list || (Array.isArray(r) ? r : []);
        const labels = new Map<string, string>();
        const n = new Map<string, number>();
        for (const x of rows) { labels.set(x.audience, x.audienceLabel); n.set(x.audience, (n.get(x.audience) || 0) + 1); }
        return { total: typeof r?.waiting === 'number' ? r.waiting : rows.length, counts: [...n.entries()].map(([k, v]) => ({ label: labels.get(k) || k, n: v })), top: rows.slice(0, 6) };
    }

    private shapeBack(r: any) {
        const rows: any[] = r?.rows || [];
        const waiting = rows.filter((x) => x.status === 'waiting').sort((a, b) => a.days_left - b.days_left).slice(0, 6);
        // the ones whose window has just passed: a nudge or a note is still worth it
        const lapsed = rows.filter((x) => x.status === 'lapsed' && x.contacted_on && (Date.parse(istDay(0)) - Date.parse(String(x.contacted_on).slice(0, 10))) / 86400000 <= x.window_days + 7).slice(0, 5);
        return { waiting, lapsed };
    }

    private loadPromised() {
        const today = istDay(0), soon = istDay(-2);
        let orders: any[] | null = null, inquiries: number | null = null, pending = 2;
        const done = () => {
            if (--pending > 0) return;
            if (orders === null && inquiries === null) return;                 // the role reads neither: no widget
            const live = (orders || []);
            this.promised = {
                arrived: live.filter((o) => o.status === 'READY' && !o.notified_at).slice(0, 5).map((o) => ({ customer: o.customer, items: o.items })),
                holdEnding: live.filter((o) => o.status === 'READY' && o.hold_until && o.hold_until >= today && o.hold_until <= soon),
                overdueInquiries: inquiries || 0, showOrders: orders !== null, showInquiries: inquiries !== null,
            };
        };
        this.commitments.list({ status: 'READY' }).subscribe({ next: (r) => { orders = r || []; done(); }, error: () => done() });
        this.http.get<any[]>(`${environment.apiHost}/inquiries`, { params: { status: 'OPEN', mine: 'true', overdue: 'true' } }).subscribe({ next: (r) => { inquiries = (r || []).length; done(); }, error: () => done() });
    }
}
