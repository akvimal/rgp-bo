import { Component, EventEmitter, Input, Output } from "@angular/core";

/**
 * The peek panel: a record read beside its list (docs/planning/UI_PATTERNS.md). It slides in from the right, the list stays where it was, and it
 * closes with Esc, the close button or a click outside. On a phone it takes the full width.
 *
 *   <app-peek [open]="!!id" title="Bill 123" subtitle="12 Nov, walk-in" [loading]="loading" [error]="error"
 *             [fullPage]="['/secure/sales/pos/view', id]" (closed)="close()" (retry)="load()">
 *     <span badges class="badge bg-info">Delivery</span>
 *     <button actions class="btn btn-sm btn-primary">Edit</button>
 *     ...body...
 *   </app-peek>
 *
 * Without a `title` there is no header block, for a panel that draws its own (the bill panel). The body stays in the page while loading or after an
 * error is shown, hidden, so a panel never loses what was typed in it.
 */
@Component({
    selector: 'app-peek',
    styles: [':host { display: contents; }'],
    template: `
    <p-sidebar [visible]="open" (visibleChange)="!$event && closed.emit()" position="right" [style]="{width: width, maxWidth: '100vw'}" [baseZIndex]="1000" [attr.data-testid]="testid + '-panel'">
      <div *ngIf="open" [attr.data-testid]="testid">
        <div class="d-flex align-items-start justify-content-between gap-2 mb-3" *ngIf="title">
          <div class="min-w-0">
            <h5 class="mb-0 text-break" [attr.data-testid]="testid + '-title'">{{title}} <ng-content select="[badges]"></ng-content></h5>
            <div class="small text-muted" *ngIf="subtitle" [attr.data-testid]="testid + '-subtitle'">{{subtitle}}</div>
          </div>
          <div class="d-flex flex-wrap gap-1 justify-content-end">
            <ng-content select="[actions]"></ng-content>
            <a class="btn btn-sm btn-outline-secondary" *ngIf="fullPage" [routerLink]="fullPage" [attr.data-testid]="testid + '-full'">{{fullPageLabel}}</a>
          </div>
        </div>
        <div class="placeholder-glow" *ngIf="loading && !error" aria-busy="true" [attr.data-testid]="testid + '-loading'">
          <span class="placeholder col-12 mb-2"></span><span class="placeholder col-8 mb-2"></span><span class="placeholder col-10"></span>
        </div>
        <div class="alert alert-danger py-2 small d-flex justify-content-between align-items-center" *ngIf="error" role="alert" [attr.data-testid]="testid + '-error'">
          <span>{{error}}</span><button type="button" class="btn btn-sm btn-outline-danger" (click)="retry.emit()" [attr.data-testid]="testid + '-retry'">Try again</button>
        </div>
        <div [hidden]="loading || !!error"><ng-content></ng-content></div>
      </div>
    </p-sidebar>`
})
export class PeekComponent {
    @Input() open = false;
    @Input() title = '';
    @Input() subtitle = '';
    @Input() width = '34rem';
    @Input() testid = 'peek';
    @Input() loading = false;
    @Input() error = '';
    /** router link to the record's own page. The panel is not closed first (two navigations would cancel each other): leaving the list takes it away, and Back returns to the list with the panel open */
    @Input() fullPage: any[] | null = null;
    @Input() fullPageLabel = 'Open full page';
    @Output() closed = new EventEmitter<void>();
    @Output() retry = new EventEmitter<void>();
}
