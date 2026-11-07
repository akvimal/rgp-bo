import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { QuickAction, quickActionsHidden } from "./quick-actions";
import { TodoService } from "./todos/todos.service";

const localDay = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * A round button at the bottom right of every screen that opens the short list of what people do most: add a to-do, see the to-dos, bill a sale,
 * enter a purchase invoice, stock audits, expenses. Hidden on the billing screens. Its badge counts the to-dos that are late or due today.
 */
@Component({
  selector: "app-quick-actions",
  template: `
    <div class="qa-wrap no-print" *ngIf="visible" data-testid="quick-actions">
      <div class="qa-menu shadow" *ngIf="open" role="menu" data-testid="quick-actions-menu">
        <a href="javascript:void(0)" class="qa-item" role="menuitem" *ngFor="let a of shown" (click)="go(a)" [attr.data-testid]="a.id">
          <i class="bi" [ngClass]="a.icon"></i><span>{{a.label}}</span>
          <span class="badge bg-danger ms-auto" *ngIf="a.badge && due > 0">{{due}}</span>
        </a>
      </div>
      <button type="button" class="qa-fab btn btn-primary shadow" (click)="open = !open" [attr.aria-expanded]="open" aria-label="Quick actions" title="Quick actions" data-testid="quick-actions-fab">
        <i class="bi" [ngClass]="open ? 'bi-x-lg' : 'bi-lightning-charge-fill'"></i>
        <span class="qa-dot" *ngIf="!open && due > 0" data-testid="quick-actions-badge">{{due > 9 ? '9+' : due}}</span>
      </button>
    </div>`,
  styles: [`
    .qa-wrap { position: fixed; right: 1rem; bottom: 1rem; z-index: 1030; display: flex; flex-direction: column; align-items: flex-end; gap: .5rem; }
    .qa-fab { width: 3.2rem; height: 3.2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; padding: 0; position: relative; }
    .qa-dot { position: absolute; top: -.25rem; right: -.25rem; min-width: 1.2rem; height: 1.2rem; border-radius: .6rem; background: #dc3545; color: #fff; font-size: .7rem; line-height: 1.2rem; text-align: center; padding: 0 .25rem; }
    .qa-menu { background: var(--bs-body-bg, #fff); border: 1px solid rgba(0,0,0,.12); border-radius: .6rem; min-width: 14rem; padding: .3rem; }
    .qa-item { display: flex; align-items: center; gap: .6rem; padding: .5rem .7rem; border-radius: .4rem; color: inherit; text-decoration: none; }
    .qa-item:hover { background: rgba(13,110,253,.1); }
    @media print { .qa-wrap { display: none !important; } }
  `]
})
export class QuickActionsComponent implements OnInit, OnDestroy {
  @Input() actions: QuickAction[] = [];

  open = false;
  visible = true;
  due = 0;
  private subs = new Subscription();
  private timer: any = null;
  private lastFetch = 0;

  constructor(private router: Router, private todos: TodoService, private host: ElementRef) {}

  get shown(): QuickAction[] { return this.actions.filter((a) => a.show()); }

  ngOnInit() {
    this.visible = !quickActionsHidden(this.router.url);
    this.subs.add(this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.open = false;
      this.visible = !quickActionsHidden(e.urlAfterRedirects || e.url);
      this.refreshDue();
    }));
    this.refreshDue();
    this.timer = setInterval(() => this.refreshDue(true), 5 * 60 * 1000);
  }

  ngOnDestroy() { this.subs.unsubscribe(); if (this.timer) clearInterval(this.timer); }

  /** to-dos late or due today, for the badge: asked at most once a minute, and only for someone who has to-dos */
  private refreshDue(force = false) {
    if (!this.actions.some((a) => a.badge && a.show())) { this.due = 0; return; }
    if (!force && Date.now() - this.lastFetch < 60000) return;
    this.lastFetch = Date.now();
    this.todos.list('mine', 'open').subscribe({
      next: (r: any) => { const today = localDay(); this.due = (r?.items || []).filter((i: any) => i.status === 'OPEN' && i.dueday <= today).length; },
      error: () => {}
    });
  }

  go(a: QuickAction) {
    this.open = false;
    this.router.navigate([a.route], a.query ? { queryParams: a.query } : undefined);
  }

  @HostListener('document:click', ['$event'])
  outside(ev: Event) { if (this.open && !this.host.nativeElement.contains(ev.target)) this.open = false; }

  @HostListener('document:keydown.escape')
  esc() { this.open = false; }
}
