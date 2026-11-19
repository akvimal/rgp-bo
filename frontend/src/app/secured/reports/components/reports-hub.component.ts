import { Component } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";
import { HubGroup, visibleHub } from "../reports-hub";

/** The Reports hub: every report the person may open, grouped by the question it answers. */
@Component({
  selector: "app2-reports-hub",
  template: `
    <div class="form-compact">
      <div class="page-head"><h1>Reports</h1><app2-reports-tabs></app2-reports-tabs></div>
      <div class="row g-2 mb-3">
        <div class="col-md-6 col-lg-4"><input class="form-control" type="search" placeholder="Find a report" [(ngModel)]="find" aria-label="Find a report" data-testid="rh-find"></div>
      </div>
      <p class="text-muted" *ngIf="!shown.length" data-testid="rh-empty">{{ find ? 'No report matches that.' : 'There is no report your role can open. Ask an owner.' }}</p>
      <section class="mb-4" *ngFor="let g of shown" [attr.data-testid]="'rh-group-' + g.key">
        <h5 class="mb-0">{{g.label}}</h5>
        <div class="small text-muted mb-2">{{g.question}}</div>
        <div class="row g-3">
          <div class="col-sm-6 col-lg-4 col-xl-3" *ngFor="let c of g.cards">
            <a class="card h-100 text-decoration-none text-reset report-card" [routerLink]="c.route" [attr.data-testid]="c.id">
              <div class="card-body">
                <div class="fw-semibold"><i class="bi {{c.icon}} me-2"></i>{{c.label}}</div>
                <div class="small text-muted mt-1">{{c.about}}</div>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>`,
  styles: [`.report-card:hover { border-color: var(--bs-primary, #0d6efd); }`],
})
export class ReportsHubComponent {
  find = "";
  private all: HubGroup[];
  constructor(auth: AuthService) {
    this.all = visibleHub({ canOpen: (u) => auth.isUrlAuthorized(u), has: (k) => auth.isActionAuthorized(k) });
  }
  get shown(): HubGroup[] {
    const q = this.find.trim().toLowerCase();
    if (!q) return this.all;
    return this.all
      .map((g) => ({ ...g, cards: g.cards.filter((c) => (c.label + " " + c.about + " " + g.label).toLowerCase().includes(q)) }))
      .filter((g) => g.cards.length > 0);
  }
}
