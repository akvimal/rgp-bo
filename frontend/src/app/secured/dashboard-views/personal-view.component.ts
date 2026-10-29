import { HttpClient } from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { environment } from "../../../environments/environment";
import { NeedsItem } from "../../shared/components/needs-strip.component";

/** The Personal view (DASHBOARD_AND_MENU_DESIGN 3.2): the person's own HR summary and nothing about sales or the store. */
@Component({
    selector: 'app-personal-view',
    template: `
    <app-needs-strip [items]="needs"></app-needs-strip>
    <div class="row g-3" *ngIf="data">
      <ng-container *ngIf="data.staff; else notStaff">
        <div class="col-md-4"><section class="card h-100" data-testid="pv-leave"><div class="card-body">
          <h2 class="h6">My leave</h2>
          <div class="fs-3 fw-bold">{{data.pendingLeave}}</div><div class="small text-muted">waiting for a decision</div>
          <div class="mt-2 small" *ngFor="let r of data.recentDecisions"><strong>{{r.type}}</strong> {{r.from_date}} to {{r.to_date}}: <span [class.text-success]="r.status === 'APPROVED'" [class.text-danger]="r.status === 'REJECTED'">{{r.status | titlecase}}</span></div>
          <a class="btn btn-sm btn-outline-primary mt-2" routerLink="/secure/my-hr">Ask for leave</a>
        </div></section></div>
        <div class="col-md-4"><section class="card h-100" data-testid="pv-pay"><div class="card-body">
          <h2 class="h6">My pay</h2>
          <div *ngIf="data.latestPayslip as s"><div class="fs-3 fw-bold">₹{{s.net | number:'1.0-0'}}</div><div class="small text-muted">net pay for {{s.period}}</div></div>
          <div *ngIf="!data.latestPayslip" class="text-muted">No payslip yet.</div>
          <div class="small mt-2" *ngIf="data.credit?.cap">Staff credit: ₹{{data.credit.outstanding | number:'1.0-0'}} of ₹{{data.credit.cap | number:'1.0-0'}}</div>
        </div></section></div>
        <div class="col-md-4"><section class="card h-100" data-testid="pv-next"><div class="card-body">
          <h2 class="h6">Coming up</h2>
          <div *ngIf="data.nextHoliday as h">Next holiday: <strong>{{h.name}}</strong>, {{h.date | date:'EEE d MMM'}}</div>
          <div *ngIf="!data.nextHoliday" class="text-muted">No holiday listed.</div>
          <a class="btn btn-sm btn-outline-primary mt-2" routerLink="/secure/my-hr">Open my HR</a>
        </div></section></div>
      </ng-container>
      <ng-template #notStaff><div class="col-12"><div class="alert alert-light">Your login is not linked to a staff record yet. Ask your Business Head to link it.</div></div></ng-template>
    </div>
    <div class="alert alert-danger mt-2" *ngIf="error">{{error}}</div>
    <div class="small text-muted mt-3">This page shows only your own details. No sales, no store figures.</div>`
})
export class PersonalViewComponent implements OnInit {
    data: any = null;
    error = '';
    constructor(private http: HttpClient) {}

    ngOnInit() {
        this.http.get(`${environment.apiHost}/my-hr/summary`).subscribe({ next: (d: any) => (this.data = d), error: (e: any) => (this.error = e?.error?.message || 'Unable to load your page') });
    }

    get needs(): NeedsItem[] {
        return [{ key: 'leave', label: 'leave requests waiting', count: this.data?.pendingLeave || 0, tone: 'info', link: ['/secure/my-hr'] }];
    }
}
