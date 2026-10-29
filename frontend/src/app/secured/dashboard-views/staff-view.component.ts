import { Component, Input, OnInit } from "@angular/core";
import { DashboardService } from "../dashboard.service";
import { NeedsItem } from "../../shared/components/needs-strip.component";
import { ComplianceItem, ComplianceService } from "../compliance/compliance.service";
import { MyRecognition, RecognitionService } from "../recognition/recognition.service";

/**
 * The Staff and Counter views (DASHBOARD_AND_MENU_DESIGN 3.2 and 6A): the person's day against their own usual, today's goals, the parked bills and
 * the store's shared day. No cost, no margin, no other person's sales, no customer names. A counter login is shared, so `shared` changes the wording.
 */
@Component({
    selector: 'app-staff-view',
    template: `
    <app-needs-strip [items]="needs"></app-needs-strip>

    <section class="alert alert-success d-flex flex-wrap align-items-center gap-3" role="status" *ngIf="celebrating.length" data-testid="sv-celebration">
      <div class="flex-grow-1"><strong>{{celebrating[0].title}}</strong><div>{{celebrating[0].text}}</div></div>
      <button class="btn btn-sm btn-outline-success" (click)="dismiss()" data-testid="sv-celebration-ok">Thanks</button>
    </section>
    <div class="alert alert-warning py-2" *ngIf="rec?.paused" data-testid="sv-paused"><strong>New badges are paused.</strong> Finish the items marked late below to start earning again; the badges you hold stay.</div>

    <section class="card mb-3" *ngIf="todo.length" aria-label="To finish" data-testid="sv-todo">
      <div class="card-body">
        <h2 class="h6">To finish <span class="text-muted fw-normal small">your own items; the step says how soon</span></h2>
        <div class="d-flex flex-wrap align-items-center gap-2 border rounded p-2 mb-1" *ngFor="let t of todo" [class.bg-light]="t.not_mine">
          <span class="badge" [ngClass]="stepBadge(t.step)" style="min-width:64px">{{t.step | titlecase}}</span>
          <div class="flex-grow-1"><strong>{{t.label}}</strong><div class="small text-muted">{{t.detail?.bill ? 'Bill ' + t.detail.bill : (t.detail?.shift || '')}} due {{t.due_on | date:'d MMM'}}</div></div>
          <button class="btn btn-sm btn-outline-secondary" *ngIf="!t.not_mine" (click)="notMine(t)">Not mine</button>
          <span class="small text-muted" *ngIf="t.not_mine">Sent to your store head</span>
        </div>
      </div>
    </section>

    <div class="row g-3 mb-3" *ngIf="data as d">
      <div class="col-lg-7">
        <section class="card h-100" aria-label="My day" data-testid="sv-day">
          <div class="card-body d-flex flex-wrap align-items-center gap-4">
            <div class="sv-ring" *ngIf="d.today.ring !== null" [style.background]="'conic-gradient(#0b7a75 ' + (d.today.ring * 3.6) + 'deg, #e3e8f5 0)'" role="img" [attr.aria-label]="ringLabel(d)">
              <div class="sv-ring-in"><span class="fs-3 fw-bold" data-testid="sv-ring">{{d.today.ring}}%</span><span class="small text-muted">of today's goal</span></div>
            </div>
            <div class="flex-grow-1">
              <div class="small text-muted">{{shared ? 'This counter today' : 'Your sales today'}}</div>
              <div class="display-6 fw-bold" data-testid="sv-sales">₹{{d.today.sales | number:'1.0-0'}}</div>
              <div class="fw-semibold" *ngIf="d.today.against as a" [class.text-success]="a.diff >= 0" [class.text-danger]="a.diff < 0" data-testid="sv-against">
                {{a.diff >= 0 ? '▲' : '▼'}} ₹{{(a.diff < 0 ? -a.diff : a.diff) | number:'1.0-0'}} {{a.diff >= 0 ? 'ahead of' : 'behind'}} the usual for this weekday
              </div>
              <div class="text-muted small" *ngIf="d.today.usual === null">Not enough earlier days yet to show a usual.</div>
              <div class="small mt-1">{{d.today.bills}} bills · average ₹{{d.today.avgBill | number:'1.0-0'}}<span *ngIf="d.today.capturePct !== null"> · mobile number on {{d.today.capturePct}}%</span></div>
            </div>
          </div>
        </section>
      </div>
      <div class="col-lg-5">
        <section class="card h-100" aria-label="The store today" data-testid="sv-store">
          <div class="card-body">
            <h2 class="h6 mb-2">Our store today</h2>
            <div class="fs-4 fw-bold">₹{{d.store.sales | number:'1.0-0'}}</div>
            <div class="small" *ngIf="d.store.against as a" [class.text-success]="a.diff >= 0" [class.text-danger]="a.diff < 0">
              {{a.diff >= 0 ? 'ahead of' : 'behind'}} the store's usual by ₹{{(a.diff < 0 ? -a.diff : a.diff) | number:'1.0-0'}}
            </div>
            <div class="mt-2 small" *ngIf="d.store.capturePct !== null">Mobile numbers on bills: <strong>{{d.store.capturePct}}%</strong> (aim {{d.store.captureAim}}%)</div>
            <div class="progress mt-1" style="height:8px" *ngIf="d.store.capturePct !== null"><div class="progress-bar" [class.bg-success]="d.store.capturePct >= d.store.captureAim" [class.bg-warning]="d.store.capturePct < d.store.captureAim" [style.width.%]="d.store.capturePct"></div></div>
            <div class="small text-muted mt-2">Shared goals: no one is ranked against anyone else.</div>
          </div>
        </section>
      </div>
    </div>

    <section class="card mb-3" *ngIf="data as d" aria-label="Today's goals" data-testid="sv-goals">
      <div class="card-body">
        <h2 class="h6">Today's goals <span class="text-muted fw-normal small">{{doneCount(d)}} of {{d.goals.length}} done</span></h2>
        <div class="row g-2">
          <div class="col-md-4" *ngFor="let g of d.goals">
            <div class="border rounded p-2 h-100" [class.border-success]="g.complete">
              <div class="d-flex justify-content-between"><strong>{{g.title}}</strong><span [class.text-success]="g.complete" class="fw-bold">{{g.complete ? '✓ Done' : g.done + ' / ' + g.of}}</span></div>
              <div class="progress my-1" style="height:6px"><div class="progress-bar" [class.bg-success]="g.complete" [style.width.%]="g.pct"></div></div>
              <div class="small text-muted">{{g.note}}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="row g-3 mb-3" *ngIf="data as d">
      <div class="col-lg-8">
        <section class="card h-100" aria-label="Today by hour" data-testid="sv-hours">
          <div class="card-body">
            <h2 class="h6">Today by hour <span class="text-muted fw-normal small">against the usual for this weekday</span></h2>
            <div class="d-flex align-items-end gap-1 sv-bars">
              <div class="flex-fill text-center" *ngFor="let h of d.hours">
                <div class="sv-bar-wrap">
                  <div class="sv-usual" *ngIf="h.usual !== null" [style.height.px]="barH(h.usual, d)" title="usual"></div>
                  <div class="sv-mine" *ngIf="h.mine !== null" [style.height.px]="barH(h.mine, d)" [attr.title]="'₹' + h.mine"></div>
                </div>
                <div class="small text-muted">{{h.hour > 12 ? h.hour - 12 : h.hour}}</div>
              </div>
            </div>
            <div class="small text-muted mt-1"><span class="sv-key sv-key-mine"></span> today <span class="sv-key sv-key-usual ms-2"></span> usual</div>
            <div class="small mt-2" *ngIf="d.week.usual !== null">Last 7 days: <strong>₹{{d.week.sales | number:'1.0-0'}}</strong> against a usual ₹{{d.week.usual | number:'1.0-0'}}<span *ngIf="d.week.capturePct !== null"> · mobile numbers {{d.week.capturePct}}%</span></div>
          </div>
        </section>
      </div>
      <div class="col-lg-4">
        <section class="card h-100" aria-label="Parked bills" data-testid="sv-parked">
          <div class="card-body">
            <h2 class="h6">Parked bills <span class="text-muted fw-normal small">{{d.parked.length}} waiting</span></h2>
            <div *ngFor="let p of d.parked" class="border rounded p-2 mb-1 d-flex justify-content-between align-items-center">
              <div><div class="fw-semibold">Bill {{p.bill_no || p.id}}</div><div class="small text-muted">₹{{p.total | number:'1.0-0'}} · parked at {{p.at}}</div></div>
              <a class="btn btn-sm btn-outline-primary" [routerLink]="['/secure/sales/pos']">Open the till</a>
            </div>
            <div *ngIf="!d.parked.length" class="text-success fw-semibold py-2">Nothing parked. Well done.</div>
          </div>
        </section>
      </div>
    </div>
    <div class="row g-3 mb-3" *ngIf="rec as r">
      <div class="col-lg-8">
        <section class="card h-100" aria-label="Your badges" data-testid="sv-badges">
          <div class="card-body">
            <h2 class="h6">{{shared ? 'Badges' : 'Your badges'}} <span class="text-muted fw-normal small">{{earnedCount(r)}} earned: good habits, never sales volume or discounts</span></h2>
            <div class="row g-2">
              <div class="col-sm-6 col-xl-4" *ngFor="let p of r.progress">
                <button type="button" class="btn w-100 text-start border" [ngClass]="p.earned ? 'border-success bg-light' : ''" (click)="pick = pick === p.rule ? null : p.rule" [attr.aria-pressed]="pick === p.rule" [attr.data-testid]="'badge-' + p.rule">
                  <strong>{{p.name}}</strong>
                  <div class="small" [class.text-success]="p.earned">{{p.earned ? 'Earned' : p.value + ' of ' + p.target + ' ' + p.unit}}</div>
                  <div class="progress" style="height:5px"><div class="progress-bar" [class.bg-success]="p.earned" [style.width.%]="pct(p)"></div></div>
                </button>
              </div>
            </div>
            <div class="small mt-2 p-2 bg-light rounded" *ngIf="picked as p"><strong>{{p.name}}</strong>: {{p.how}} <span *ngIf="p.note" class="text-warning">({{p.note}})</span></div>
            <div class="small text-muted mt-2" *ngIf="!picked">A badge is for a period: it lapses if the habit stops, and a late item of yours pauses new ones.</div>
          </div>
        </section>
      </div>
      <div class="col-lg-4">
        <section class="card h-100" aria-label="Notes" data-testid="sv-notes">
          <div class="card-body">
            <h2 class="h6">Notes from your store head and owner</h2>
            <div class="border-start border-3 border-primary ps-2 mb-2" *ngFor="let n of r.notes"><div class="fw-semibold">{{n.text}}</div><div class="small text-muted">{{n.from_name}} · {{n.at | date:'d MMM'}}</div></div>
            <div class="text-muted small" *ngIf="!r.notes.length">No notes yet.</div>
          </div>
        </section>
      </div>
    </div>
    <div class="alert alert-danger" *ngIf="error">{{error}}</div>
    <div class="small text-muted">This page never shows cost, margin, purchases, other people's sales or customer lists.</div>`,
    styles: [`
      .sv-ring { position: relative; width: 140px; height: 140px; border-radius: 50%; flex: 0 0 140px; }
      .sv-ring-in { position: absolute; inset: 13px; border-radius: 50%; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .sv-bars { height: 150px; }
      .sv-bar-wrap { position: relative; height: 130px; display: flex; align-items: flex-end; justify-content: center; }
      .sv-usual { position: absolute; bottom: 0; width: 70%; background: #d8dff3; border-radius: 3px 3px 0 0; }
      .sv-mine { position: relative; width: 40%; background: #3346d3; border-radius: 3px 3px 0 0; }
      .sv-key { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -1px; margin-right: 4px; }
      .sv-key-mine { background: #3346d3; } .sv-key-usual { background: #d8dff3; }
    `]
})
export class StaffViewComponent implements OnInit {
    /** a shared counter login: the figures are the counter's */
    @Input() shared = false;
    data: any = null;
    error = '';

    todo: ComplianceItem[] = [];
    rec: MyRecognition | null = null;
    pick: string | null = null;
    dismissed = false;

    constructor(private dashboard: DashboardService, private compliance: ComplianceService, private recognition: RecognitionService) {}

    /** the celebration shows once per new badge or note: the first view after it arrives */
    get celebrating(): { title: string; text: string }[] {
        const r = this.rec;
        if (!r || this.dismissed) return [];
        const out: { title: string; text: string }[] = [];
        for (const a of r.awards.filter(x => !x.seen && !x.lapsed_on)) out.push({ title: 'New badge: ' + a.name, text: a.how + ' Thank you.' });
        for (const n of r.notes.filter(x => !x.seen)) out.push({ title: 'A note from ' + n.from_name, text: n.text });
        return out;
    }
    get picked() { return this.rec?.progress.find(p => p.rule === this.pick) || null; }
    earnedCount(r: MyRecognition): number { return r.progress.filter(p => p.earned).length; }
    pct(p: { value: number; target: number }): number { return p.target ? Math.min(100, Math.round((p.value / p.target) * 100)) : 0; }
    dismiss() { this.dismissed = true; this.recognition.seen().subscribe({ next: () => {}, error: () => {} }); }

    ngOnInit() {
        this.loadTodo();
        this.recognition.mine().subscribe({ next: (r) => (this.rec = r), error: () => {} });
        this.dashboard.getMine().subscribe({ next: (d: any) => (this.data = d), error: (e: any) => (this.error = e?.error?.message || 'Unable to load your page') });
    }

    loadTodo() { this.compliance.mine().subscribe({ next: (r) => (this.todo = r), error: () => {} }); }
    notMine(t: ComplianceItem) { this.compliance.notMine(t.id).subscribe({ next: () => this.loadTodo(), error: () => {} }); }
    stepBadge(s: string): string { return ({ reminder: 'bg-info text-dark', due: 'bg-primary', late: 'bg-warning text-dark', escalated: 'bg-danger', waived: 'bg-secondary' } as any)[s] || 'bg-light text-dark'; }

    get needs(): NeedsItem[] {
        const d = this.data;
        if (!d) return [];
        return [
            { key: 'todo', label: 'items to finish', count: this.todo.filter(t => !t.not_mine && ['due', 'late', 'escalated'].includes(t.step)).length, tone: 'bad', link: ['/secure/dashboard'] },
            { key: 'parked', label: 'parked bills', count: d.parked.length, tone: 'warn', link: ['/secure/sales/pos'] },
            { key: 'goals', label: 'goals still open', count: d.goals.filter((g: any) => !g.complete).length, tone: 'info', link: ['/secure/dashboard'] },
        ];
    }

    ringLabel(d: any): string { return 'You are at ' + d.today.ring + ' percent of today goal'; }
    doneCount(d: any): number { return d.goals.filter((g: any) => g.complete).length; }

    barH(v: number, d: any): number {
        const max = Math.max(1, ...d.hours.map((h: any) => Math.max(h.mine || 0, h.usual || 0)));
        return Math.max(3, Math.round((v / max) * 124));
    }
}
