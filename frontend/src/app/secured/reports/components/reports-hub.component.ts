import { Component, OnInit } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";
import { InsightsService } from "src/app/shared/insights.service";
import { HubFigure, HubGroup, showFigure, trendOf, visibleHub } from "../reports-hub";

/** The Reports hub: the figures for a period on each card, and the link to the page behind it, for every report the person may open. */
@Component({
  selector: "app2-reports-hub",
  template: `
    <div class="form-compact">
      <div class="page-head"><h1>Reports</h1><app2-reports-tabs></app2-reports-tabs></div>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
        <div class="col-md-5 col-lg-3 p-0"><input class="form-control" type="search" placeholder="Find a report" [(ngModel)]="find" aria-label="Find a report" data-testid="rh-find"></div>
        <label class="small text-muted ms-md-auto" for="rh-period">Figures for</label>
        <select id="rh-period" class="form-select w-auto" [ngModel]="period" (ngModelChange)="load($event)" data-testid="rh-period">
          <option *ngFor="let p of periods" [value]="p.key">{{p.label}}</option>
        </select>
      </div>
      <div class="small text-muted mb-3" *ngIf="range" data-testid="rh-range">{{range}}<span *ngIf="compared"> &middot; compared with {{compared}}</span></div>
      <p class="text-muted" *ngIf="!shown.length" data-testid="rh-empty">{{ find ? 'No report matches that.' : 'There is no report your role can open. Ask an owner.' }}</p>
      <section class="mb-4" *ngFor="let g of shown" [attr.data-testid]="'rh-group-' + g.key">
        <h5 class="mb-0">{{g.label}}</h5>
        <div class="small text-muted mb-2">{{g.question}}</div>
        <div class="row g-3">
          <div class="col-sm-6 col-lg-4 col-xl-3" *ngFor="let c of g.cards">
            <a class="card h-100 text-decoration-none text-reset report-card" [routerLink]="c.route" [attr.data-testid]="c.id">
              <div class="card-body">
                <div class="fw-semibold"><i class="bi {{c.icon}} me-2"></i>{{c.label}}</div>
                <div class="d-flex flex-wrap gap-3 mt-2" *ngIf="figures(c.id) as fs" [attr.data-testid]="c.id + '-figures'">
                  <div *ngFor="let f of fs">
                    <div class="fs-5 lh-1">{{show(f)}}</div>
                    <div class="small text-muted">{{f.label}}</div>
                    <div class="small" *ngIf="trend(f) as t" [class.text-success]="t.dir === 'up'" [class.text-danger]="t.dir === 'down'" [class.text-muted]="t.dir === 'flat'">
                      <i class="bi" [class.bi-arrow-up-short]="t.dir === 'up'" [class.bi-arrow-down-short]="t.dir === 'down'" [class.bi-dash]="t.dir === 'flat'"></i>{{t.text}}
                    </div>
                  </div>
                </div>
                <div class="small text-muted mt-2">{{c.about}}</div>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>`,
  styles: [`.report-card:hover { border-color: var(--bs-primary, #0d6efd); }`],
})
export class ReportsHubComponent implements OnInit {
  find = "";
  period = "this_month";
  periods: { key: string; label: string }[] = [{ key: "this_month", label: "This month" }];
  range = "";
  compared = "";
  private tiles: Record<string, { figures: HubFigure[]; asOfNow: boolean }> = {};
  private all: HubGroup[];
  show = showFigure;
  trend = trendOf;

  constructor(auth: AuthService, private insights: InsightsService) {
    this.all = visibleHub({ has: (...k) => k.some((x) => auth.isActionAuthorized(x)) });
    try { const p = localStorage.getItem("rh-period"); if (p) this.period = p; } catch { /* the choice is only a convenience */ }
  }

  ngOnInit() { this.load(this.period); }

  /** the figures for a period; when they cannot be had the cards stay plain links */
  load(period: string) {
    this.period = period;
    try { localStorage.setItem("rh-period", period); } catch { /* ignore */ }
    this.insights.hubSummary(period).subscribe({
      next: (r) => {
        this.tiles = r.tiles || {};
        this.periods = r.periods || this.periods;
        this.period = r.period?.key || this.period;
        this.range = r.period ? this.span(r.period.from, r.period.to) : "";
        this.compared = r.compared ? this.span(r.compared.from, r.compared.to) : "";
      },
      error: () => { this.tiles = {}; this.range = ""; this.compared = ""; },
    });
  }

  private span(from: string, to: string): string { return from === to ? from : `${from} to ${to}`; }

  figures(id: string): HubFigure[] | null {
    const t = this.tiles[id];
    return t && t.figures.length ? t.figures : null;
  }

  get shown(): HubGroup[] {
    const q = this.find.trim().toLowerCase();
    if (!q) return this.all;
    return this.all
      .map((g) => ({ ...g, cards: g.cards.filter((c) => (c.label + " " + c.about + " " + g.label).toLowerCase().includes(q)) }))
      .filter((g) => g.cards.length > 0);
  }
}
