import { Component, OnInit } from "@angular/core";
import { DashboardService } from "../dashboard.service";

/**
 * My follow-ups: the refill and call-back work, on a page of its own so the dashboard stays short (docs/planning/REFILL_CRM_DASHBOARD.md). A person sees their
 * own contacts and scorecard; a manager sees the team's; the owner can also change the return windows. The panel itself is `app-my-work`.
 */
@Component({
    selector: 'app-followups-page',
    template: `
    <div class="form-compact">
      <div class="pagetitle d-flex align-items-center justify-content-between">
        <h1>{{shared ? 'Follow-ups for this counter' : 'My follow-ups'}}</h1>
        <a class="btn btn-sm btn-outline-secondary" [routerLink]="['/secure/dashboard']" data-testid="fu-back">Dashboard</a>
      </div>
      <p class="small text-muted mb-2">Who to call or message, who has not come back yet, what was promised to customers, and the regulars we cannot reach.</p>
      <app-my-work *ngIf="ready" [shared]="shared" [canSetWindows]="owner"></app-my-work>
    </div>`
})
export class FollowupsPageComponent implements OnInit {
    ready = false;
    /** a shared counter login: the wording is the counter's */
    shared = false;
    /** the owner may change the return windows */
    owner = false;

    constructor(private dashboard: DashboardService) {}

    ngOnInit() {
        // the same answer that picks the dashboard view: which kind of login this is
        this.dashboard.getView().subscribe({
            next: (v: any) => { this.shared = v?.view === 'counter'; this.owner = v?.view === 'owner'; this.ready = true; },
            error: () => { this.ready = true; },
        });
    }
}
