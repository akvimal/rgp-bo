import { Component, OnInit } from "@angular/core";
import { DisposalService } from "../disposal.service";

/** Stock > Out-passes: the passes for goods that left (or are about to leave) the shop as waste. */
@Component({
    template: `
    <div class="mt-2" data-testid="passes-screen">
      <div class="d-flex flex-wrap align-items-end gap-2 mb-2">
        <div><label class="form-label small mb-0">Show</label>
          <select class="form-select form-select-sm" [(ngModel)]="status" (ngModelChange)="load()" data-testid="passes-status">
            <option value="">All</option><option value="DRAFT">Waiting for approval</option><option value="APPROVED">Approved, goods not handed over</option>
            <option value="CONFIRMED">Handed over</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select></div>
        <a routerLink="../expiry" class="btn btn-primary btn-sm">New: from the Expiry list</a>
      </div>
      <div class="alert alert-danger py-2" *ngIf="error">{{error}}</div>
      <p-table [value]="rows" [paginator]="true" [rows]="25" styleClass="p-datatable-gridlines p-datatable-sm" data-testid="passes-table">
        <ng-template pTemplate="header"><tr><th>No.</th><th>Store</th><th>Why</th><th>How</th><th class="text-end">Lines</th><th class="text-end">Units</th><th class="text-end">At cost</th><th>Status</th><th>Made</th></tr></ng-template>
        <ng-template pTemplate="body" let-p>
          <tr data-testid="pass-row">
            <td><a [routerLink]="[p.id]" data-testid="pass-link">{{p.pass_no}}</a> <span class="badge bg-danger" *ngIf="p.scheduled" title="Includes a scheduled drug">H</span></td>
            <td>{{p.store}}</td><td>{{label(p.reason)}}</td><td>{{method(p.method)}}</td>
            <td class="text-end">{{p.lines}}</td><td class="text-end">{{p.qty}}</td><td class="text-end">{{p.cost_value | number:'1.2-2'}}</td>
            <td><span class="badge" [ngClass]="badge(p.status)">{{statusText(p.status)}}</span></td>
            <td class="small">{{p.prepared_on | date:'dd MMM yyyy'}}<div class="text-muted">{{p.prepared_by_name}}</div></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="9" class="text-center text-muted py-3">No out-passes yet.</td></tr></ng-template>
      </p-table>
    </div>`
})
export class DisposalListComponent implements OnInit {
    rows: any[] = [];
    status = "";
    error = "";
    constructor(private service: DisposalService) {}
    ngOnInit() { this.load(); }
    load() {
        this.error = "";
        this.service.list(this.status ? { status: this.status } : {}).subscribe((r: any) => this.rows = r.rows || [], (e: any) => this.error = this.service.msg(e, "The out-passes could not be loaded."));
    }
    label(r: string) { return ({ EXPIRED: "Expired", NEAR_EXPIRY: "Near expiry", DAMAGED: "Damaged" } as any)[r] || r; }
    method(m: string) { return ({ DESTROYED: "Destroyed on site", AGENCY: "Disposal agency", VENDOR: "Back to the vendor", OTHER: "Other" } as any)[m] || m; }
    statusText(s: string) { return ({ DRAFT: "Waiting for approval", APPROVED: "Held, not handed over", CONFIRMED: "Handed over", REJECTED: "Rejected", CANCELLED: "Cancelled" } as any)[s] || s; }
    badge(s: string) { return s === "CONFIRMED" ? "bg-success" : s === "APPROVED" ? "bg-warning text-dark" : s === "DRAFT" ? "bg-info text-dark" : "bg-secondary"; }
}
