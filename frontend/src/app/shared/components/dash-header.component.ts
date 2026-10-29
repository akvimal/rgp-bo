import { Component, Input } from "@angular/core";

/**
 * The top of every dashboard view (DASHBOARD_AND_MENU_DESIGN 6A): the title, then the scope bar saying whose figures these are and how fresh.
 * The view's own choices (period, comparison) are projected into the bar.
 */
@Component({
    selector: 'app-dash-header',
    template: `
    <div class="pagetitle dashboard" data-testid="dash-root">
      <h1>{{title}}</h1>
      <div class="small text-muted">{{subtitle}}</div>
    </div>
    <div class="card mb-3 dash-scope" data-testid="dash-scope">
      <div class="card-body py-2 d-flex flex-wrap align-items-center gap-3">
        <span class="fw-semibold">{{scope}}</span>
        <ng-content></ng-content>
        <span class="ms-auto small text-muted" data-testid="dash-updated">Updated {{updated}}</span>
      </div>
    </div>`
})
export class DashHeaderComponent {
    @Input() title = 'Dashboard';
    @Input() subtitle = '';
    @Input() scope = '';
    @Input() updated = '';
}
