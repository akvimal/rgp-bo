import { Component, EventEmitter, Input, Output } from "@angular/core";

/**
 * The frame every dashboard card sits in (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 1): a title, a "what is this" sentence, a link to where
 * the figures come from, a placeholder while loading, an error with a retry, and an empty text. A card puts its own content inside and keeps its own
 * data; the frame only decides what is shown around it. Content stays in the page while hidden, so a card never loses its state.
 * Use `<span sub>` for a small note beside the title and `<div actions>` for controls on the right.
 */
@Component({
    selector: 'app-widget',
    styles: [':host { display: block; }'],
    template: `
    <section class="card mb-3" [attr.aria-label]="title" [attr.data-testid]="testid">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <h2 class="h6 mb-0">{{title}} <span class="text-muted fw-normal small"><ng-content select="[sub]"></ng-content></span></h2>
          <div class="d-flex gap-2 align-items-center">
            <span class="small text-muted" *ngIf="asOf" [attr.data-testid]="testid + '-asof'" title="When this figure was worked out. Figures are kept for a while and worked out again on their own.">{{updating ? 'Updating…' : 'As of ' + (asOf | date:'d MMM, h:mm a')}}</span>
            <button type="button" class="btn btn-sm btn-link p-0" *ngIf="asOf" [disabled]="updating" (click)="refresh.emit()" [attr.data-testid]="testid + '-refresh'">Refresh</button>
            <ng-content select="[actions]"></ng-content>
            <button type="button" class="btn btn-sm btn-link p-0" (click)="info = !info" [attr.aria-expanded]="info" aria-label="What is this?" [attr.data-testid]="testid + '-info'" *ngIf="definition">?</button>
            <a class="small" [routerLink]="drill" *ngIf="drill" [attr.data-testid]="testid + '-open'">Open</a>
          </div>
        </div>
        <div class="small border rounded p-2 mb-2 bg-light" *ngIf="info && definition" [attr.data-testid]="testid + '-definition'">{{definition}}</div>
        <div class="placeholder-glow" *ngIf="loading && !error" aria-busy="true" [attr.data-testid]="testid + '-loading'">
          <span class="placeholder col-12 mb-2"></span><span class="placeholder col-9 mb-2"></span><span class="placeholder col-6"></span>
        </div>
        <div class="alert alert-danger py-2 small d-flex justify-content-between align-items-center mb-0" *ngIf="error" role="alert" [attr.data-testid]="testid + '-error'">
          <span>{{error}}</span><button type="button" class="btn btn-sm btn-outline-danger" (click)="retry.emit()" [attr.data-testid]="testid + '-retry'">Try again</button>
        </div>
        <div class="text-muted small" *ngIf="!loading && !error && empty" [attr.data-testid]="testid + '-empty'">{{emptyText}}</div>
        <div [hidden]="loading || !!error || empty"><ng-content></ng-content></div>
      </div>
    </section>`
})
export class WidgetFrameComponent {
    @Input() title = '';
    @Input() testid = 'widget';
    @Input() definition = '';
    @Input() drill: string | null = null;
    @Input() loading = false;
    @Input() error = '';
    @Input() empty = false;
    @Input() emptyText = 'Nothing to show yet.';
    /** when the figure was worked out (the server keeps heavy figures for an hour, a day or a week); set it to show the time and a Refresh link */
    @Input() asOf: string | null | undefined = null;
    /** the server has shown the kept figure and is working out a new one */
    @Input() updating = false;
    @Output() retry = new EventEmitter<void>();
    @Output() refresh = new EventEmitter<void>();
    info = false;
}
