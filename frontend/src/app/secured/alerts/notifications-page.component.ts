import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "src/app/@core/auth/auth.service";
import { AlertsService } from "./alerts.service";

/** Everything that needs the person's attention, with what to do about it; and the language the alerts are written in. */
@Component({
  selector: 'app2-notifications-page',
  template: `
<div class="card">
  <div class="card-body">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3 mb-2">
      <h5 class="card-title m-0 p-0">Notifications</h5>
      <div class="d-flex align-items-center gap-3 flex-wrap">
        <div class="form-check m-0">
          <input class="form-check-input" type="checkbox" id="np-all" [checked]="status === 'all'" (change)="setStatus($any($event.target).checked ? 'all' : 'open')" data-testid="np-show-all">
          <label class="form-check-label small" for="np-all">Include dismissed and resolved (last 7 days)</label>
        </div>
        <div class="d-flex align-items-center gap-2">
          <label class="small text-muted mb-0" for="np-lang">Show alerts in</label>
          <select class="form-select form-select-sm w-auto" id="np-lang" [(ngModel)]="language" (change)="saveLanguage()" data-testid="np-language">
            <option value="en">English</option>
            <option value="ta">தமிழ் (Tamil)</option>
          </select>
        </div>
        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="markAll()" [disabled]="!unread" data-testid="np-read-all">Mark all read</button>
      </div>
    </div>

    <div *ngIf="loading" class="text-muted py-3">Loading...</div>
    <div *ngIf="!loading && !items.length" class="text-muted py-4 text-center" data-testid="np-empty">Nothing needs your attention.</div>

    <ul class="list-group list-group-flush" *ngIf="items.length">
      <li class="list-group-item px-0 d-flex gap-3" *ngFor="let n of items" data-testid="np-item" [attr.data-code]="n.code" [attr.data-status]="n.status" [class.opacity-50]="n.status !== 'open'">
        <i class="bi fs-5 mt-1" [ngClass]="icon(n)"></i>
        <div class="flex-grow-1">
          <div [class.fw-semibold]="!n.read" data-testid="np-title">{{ n.title }}</div>
          <div class="text-muted small">{{ n.message }}</div>
          <div class="text-muted small mt-1">
            <span *ngIf="n.store">{{ n.store }} &middot; </span>{{ n.createdon | date:'d MMM, h:mm a' }}
            <span class="badge bg-secondary ms-1" *ngIf="n.status !== 'open'">{{ n.status }}</span>
          </div>
        </div>
        <div class="d-flex align-items-start gap-1 flex-wrap justify-content-end" *ngIf="n.status === 'open' || n.status === 'snoozed'">
          <button class="btn btn-sm btn-primary" type="button" *ngIf="n.link && canOpen(n)" (click)="open(n)" data-testid="np-open">Open</button>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" (click)="snoozeFor = snoozeFor === n.id ? 0 : n.id" data-testid="np-snooze">Snooze</button>
            <ul class="dropdown-menu" [class.show]="snoozeFor === n.id">
              <li><a class="dropdown-item" href="javascript:void(0)" (click)="snooze(n, 1)">1 hour</a></li>
              <li><a class="dropdown-item" href="javascript:void(0)" (click)="snooze(n, 4)">4 hours</a></li>
              <li><a class="dropdown-item" href="javascript:void(0)" (click)="snooze(n, 24)" data-testid="np-snooze-24">Until tomorrow</a></li>
            </ul>
          </div>
          <button class="btn btn-sm btn-outline-secondary" type="button" (click)="dismiss(n)" data-testid="np-dismiss">Dismiss</button>
        </div>
      </li>
    </ul>
    <div class="small text-muted mt-3">An alert goes away by itself once the cause is fixed. Dismissing hides it for you only, until the same cause comes back.</div>
  </div>
</div>`,
})
export class NotificationsPageComponent implements OnInit {
  items: any[] = [];
  unread = 0;
  loading = true;
  status: 'open' | 'all' = 'open';
  language = 'en';
  snoozeFor = 0;

  constructor(private alerts: AlertsService, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.alerts.prefs().subscribe((p) => this.language = p.language, () => {});
    this.load();
  }

  load() {
    this.alerts.list(this.status).subscribe((r) => { this.items = r.items; this.unread = r.unread; this.loading = false; this.alerts.refresh(); }, () => this.loading = false);
  }

  setStatus(s: 'open' | 'all') { this.status = s; this.load(); }

  icon(n: any) {
    return n.severity === 'critical' ? 'bi-exclamation-octagon-fill text-danger' : n.severity === 'warning' ? 'bi-exclamation-triangle-fill text-warning' : 'bi-info-circle-fill text-primary';
  }

  canOpen(n: any) { return this.auth.isUrlAuthorized(n.link); }

  open(n: any) { this.alerts.read(n.id).subscribe(() => this.alerts.refresh(), () => {}); this.router.navigateByUrl(n.link); }
  dismiss(n: any) { this.alerts.dismiss(n.id).subscribe(() => this.load()); }
  snooze(n: any, hours: number) { this.snoozeFor = 0; this.alerts.snooze(n.id, hours).subscribe(() => this.load()); }
  markAll() { this.alerts.readAll().subscribe(() => this.load()); }
  saveLanguage() { this.alerts.savePrefs(this.language).subscribe(() => this.load()); }
}
