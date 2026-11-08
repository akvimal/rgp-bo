import { Component, OnDestroy, OnInit } from "@angular/core";
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

    <!-- alerts on the person's own Telegram -->
    <div class="border rounded p-3 mb-3" *ngIf="tg && tg.configured && tg.enabled" data-testid="np-telegram">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <i class="bi bi-telegram fs-5 text-primary"></i>
        <span class="fw-semibold">Alerts on Telegram</span>
        <a class="small" routerLink="/secure/help/telegram" data-testid="np-tg-help"><i class="bi bi-question-circle me-1"></i>Help</a>
        <span class="badge bg-success" *ngIf="tg.linked" data-testid="np-tg-connected">Connected<span *ngIf="tg.handle"> as @{{tg.handle}}</span></span>
        <span class="badge bg-secondary" *ngIf="!tg.linked && tg.status === 'STOPPED'">Stopped</span>
        <span class="badge bg-danger" *ngIf="tg.status === 'BLOCKED'" title="Telegram refused the last message: the bot was blocked">Blocked</span>
        <span class="small text-muted" *ngIf="!tg.linked && !tgLink">Get the alerts that matter on your phone, even when the app is closed.</span>
        <span class="ms-auto d-flex gap-2">
          <button class="btn btn-sm btn-primary" type="button" *ngIf="!tg.linked || tg.status === 'BLOCKED'" (click)="connectTelegram()" [disabled]="tgBusy" data-testid="np-tg-connect">{{tg.status === 'BLOCKED' || tg.status === 'STOPPED' ? 'Reconnect' : 'Connect Telegram'}}</button>
          <button class="btn btn-sm btn-outline-secondary" type="button" *ngIf="tg.linked" (click)="testTelegram()" data-testid="np-tg-test">Send a test</button>
          <button class="btn btn-sm btn-outline-secondary" type="button" *ngIf="tg.linked || tg.status" (click)="disconnectTelegram()" data-testid="np-tg-disconnect">Disconnect</button>
        </span>
      </div>
      <div class="mt-2 small" *ngIf="tgLink" data-testid="np-tg-link">
        <a class="btn btn-sm btn-outline-primary me-2" [href]="tgLink.url" target="_blank" rel="noopener" data-testid="np-tg-open">Open Telegram</a>
        Press <b>Start</b> there. This page notices when you are connected. The link works once and ends in {{tgLink.minutes}} minutes.
      </div>
      <div class="d-flex flex-wrap align-items-end gap-3 mt-3" *ngIf="tg.linked" data-testid="np-tg-prefs">
        <div><label class="form-label small mb-0" for="tg-level">Send me</label>
          <select class="form-select form-select-sm" id="tg-level" [(ngModel)]="tg.min_severity" data-testid="np-tg-level">
            <option value="info">Everything</option><option value="warning">Warnings and critical</option><option value="critical">Critical only</option></select></div>
        <div><label class="form-label small mb-0" for="tg-from">Quiet from</label><input type="time" class="form-control form-control-sm" id="tg-from" [(ngModel)]="tg.quiet_from" data-testid="np-tg-from"></div>
        <div><label class="form-label small mb-0" for="tg-to">until</label><input type="time" class="form-control form-control-sm" id="tg-to" [(ngModel)]="tg.quiet_to" data-testid="np-tg-to"></div>
        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="tg.quiet_from = null; tg.quiet_to = null">No quiet hours</button>
        <button class="btn btn-sm btn-primary" type="button" (click)="saveTelegram()" data-testid="np-tg-save">Save</button>
        <span class="small text-muted w-100">Critical alerts come at any hour; lower ones wait until the quiet hours end.</span>
      </div>
      <div class="small text-success mt-2" *ngIf="tgMessage" data-testid="np-tg-message">{{tgMessage}}</div>
      <div class="small text-danger mt-2" *ngIf="tgError" data-testid="np-tg-error">{{tgError}}</div>
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
export class NotificationsPageComponent implements OnInit, OnDestroy {
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
    this.loadTelegram();
  }

  ngOnDestroy() { clearInterval(this.tgTimer); }

  // ------------------------------------------------------------ Telegram
  tg: any = null;
  tgLink: any = null;
  tgBusy = false;
  tgMessage = '';
  tgError = '';
  private tgTimer: any = null;

  private say(e: any, fallback: string): string { const m = e?.error?.message; return (Array.isArray(m) ? m.join(' ') : m) || fallback; }

  loadTelegram() { this.alerts.tgMe().subscribe((me) => this.tg = me, () => this.tg = null); }

  /** makes the one-time link; the person presses Start in Telegram, and this page sees them connected */
  connectTelegram() {
    this.tgError = ''; this.tgMessage = ''; this.tgBusy = true;
    this.alerts.tgLink().subscribe((l) => {
      this.tgBusy = false; this.tgLink = l;
      clearInterval(this.tgTimer);
      let n = 0;
      this.tgTimer = setInterval(() => {
        if (++n > 300) { clearInterval(this.tgTimer); return; }
        this.alerts.tgMe().subscribe((me) => {
          if (me.linked && me.status === 'ACTIVE') { clearInterval(this.tgTimer); this.tg = me; this.tgLink = null; this.tgMessage = 'Connected. Alerts will come to your Telegram.'; }
        }, () => undefined);
      }, 3000);
    }, (e) => { this.tgBusy = false; this.tgError = this.say(e, 'Could not make the link.'); });
  }

  saveTelegram() {
    this.tgError = ''; this.tgMessage = '';
    this.alerts.tgSave({ min_severity: this.tg.min_severity, quiet_from: this.tg.quiet_from || null, quiet_to: this.tg.quiet_to || null })
      .subscribe((me) => { this.tg = me; this.tgMessage = 'Saved.'; }, (e) => this.tgError = this.say(e, 'Could not save.'));
  }

  testTelegram() {
    this.tgError = ''; this.tgMessage = '';
    this.alerts.tgTest().subscribe(() => this.tgMessage = 'A test message was sent. Check Telegram.', (e) => { this.tgError = this.say(e, 'The test did not go.'); this.loadTelegram(); });
  }

  disconnectTelegram() {
    this.tgError = ''; this.tgMessage = ''; clearInterval(this.tgTimer); this.tgLink = null;
    this.alerts.tgUnlink().subscribe((me) => { this.tg = me; this.tgMessage = 'Disconnected.'; }, (e) => this.tgError = this.say(e, 'Could not disconnect.'));
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
