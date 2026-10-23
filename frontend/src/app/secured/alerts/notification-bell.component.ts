import { Component, ElementRef, HostListener, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subscription, timer } from "rxjs";
import { AuthService } from "src/app/@core/auth/auth.service";
import { AlertsService } from "./alerts.service";

/** The bell in the header: how many alerts are waiting, and the latest few. It asks again every minute. */
@Component({
  selector: 'li[app2-notification-bell]',
  template: `
    <a class="nav-link nav-icon position-relative" href="javascript:void(0)" (click)="toggle($event)" data-testid="bell-button"
       [attr.aria-label]="'Notifications, ' + unread + ' unread'" [attr.aria-expanded]="open">
      <i class="bi bi-bell"></i>
      <span class="badge bg-danger badge-number" *ngIf="unread > 0" data-testid="bell-count">{{ unread > 99 ? '99+' : unread }}</span>
    </a>
    <ul class="dropdown-menu dropdown-menu-end dropdown-menu-arrow notifications show" *ngIf="open" data-testid="bell-menu" style="min-width:21rem;max-width:24rem">
      <li class="dropdown-header d-flex justify-content-between align-items-center">
        <span>{{ items.length ? 'Needs your attention' : 'Nothing needs your attention' }}</span>
        <a href="javascript:void(0)" class="small" *ngIf="unread > 0" (click)="readAll()" data-testid="bell-read-all">Mark all read</a>
      </li>
      <li><hr class="dropdown-divider"></li>
      <li *ngFor="let n of top" class="notification-item px-3 py-2" style="cursor:pointer" [class.fw-semibold]="!n.read" (click)="go(n)" data-testid="bell-item">
        <i class="bi me-2" [ngClass]="icon(n)"></i>
        <div class="d-inline-block align-top" style="width:calc(100% - 1.8rem)">
          <div class="small">{{ n.title }}</div>
          <div class="small text-muted fw-normal">{{ n.message }}</div>
        </div>
      </li>
      <li *ngIf="items.length > top.length" class="px-3 small text-muted">and {{ items.length - top.length }} more</li>
      <li><hr class="dropdown-divider"></li>
      <li class="text-center pb-1"><a href="javascript:void(0)" (click)="all()" data-testid="bell-all">See all</a></li>
    </ul>`,
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  open = false;
  items: any[] = [];
  unread = 0;
  private subs = new Subscription();

  constructor(private alerts: AlertsService, private router: Router, private auth: AuthService, private host: ElementRef) {}

  ngOnInit() {
    this.subs.add(this.alerts.items$.subscribe((i) => this.items = i));
    this.subs.add(this.alerts.unread$.subscribe((n) => this.unread = n));
    this.subs.add(timer(0, 60000).subscribe(() => this.alerts.refresh()));
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  get top() { return this.items.slice(0, 6); }

  icon(n: any) {
    return n.severity === 'critical' ? 'bi-exclamation-octagon-fill text-danger' : n.severity === 'warning' ? 'bi-exclamation-triangle-fill text-warning' : 'bi-info-circle-fill text-primary';
  }

  toggle(e: Event) { e.stopPropagation(); this.open = !this.open; if (this.open) this.alerts.refresh(); }

  @HostListener('document:click', ['$event'])
  outside(e: Event) { if (this.open && !this.host.nativeElement.contains(e.target)) this.open = false; }

  go(n: any) {
    this.open = false;
    this.alerts.read(n.id).subscribe(() => this.alerts.refresh(), () => {});
    // a link the person's role cannot open would send them to the login page: leave them where they are
    if (n.link && this.auth.isUrlAuthorized(n.link)) this.router.navigateByUrl(n.link);
  }

  readAll() { this.alerts.readAll().subscribe(() => this.alerts.refresh(), () => {}); }

  all() { this.open = false; this.router.navigateByUrl('/secure/notifications'); }
}
