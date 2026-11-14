import { Component, Input } from "@angular/core";

/**
 * The collapsible section (docs/planning/UI_PATTERNS.md): a title, an optional one-line summary shown while closed, an optional count or alert badge,
 * and a chevron. Open it by default when it holds something that needs action; leave it closed when it is only history or detail.
 *
 *   <app-section title="Documents" summary="3 files, 1 waiting" [count]="3" [alert]="1" [open]="false"> ... </app-section>
 */
@Component({
    selector: 'app-section',
    styles: [':host { display: block; } .head { cursor: pointer; user-select: none; }'],
    template: `
    <section class="border rounded mb-2" [attr.data-testid]="testid">
      <button type="button" class="head btn btn-link text-decoration-none text-reset w-100 d-flex align-items-center gap-2 text-start p-2" (click)="open = !open" [attr.aria-expanded]="open" [attr.data-testid]="testid + '-toggle'">
        <i class="bi" [ngClass]="open ? 'bi-chevron-down' : 'bi-chevron-right'" aria-hidden="true"></i>
        <span class="fw-semibold">{{title}}</span>
        <span class="badge bg-light text-dark border" *ngIf="count !== null">{{count}}</span>
        <span class="badge bg-danger" *ngIf="alert > 0">{{alert}}</span>
        <span class="small text-muted ms-1 text-truncate" *ngIf="!open && summary">{{summary}}</span>
      </button>
      <div class="p-2 pt-0" [hidden]="!open"><ng-content></ng-content></div>
    </section>`
})
export class SectionComponent {
    @Input() title = '';
    @Input() summary = '';
    @Input() count: number | null = null;
    @Input() alert = 0;
    @Input() open = false;
    @Input() testid = 'section';
}
