import { Component, OnInit } from "@angular/core";
import { MyHrApi } from "../my-hr/my-hr.service";

/** Leave requests of the staff you answer for: approve, or decline with a reason. */
@Component({
  selector: "app-leave-approvals",
  template: `
    <div class="pagetitle"><h1>Leave requests</h1></div>
    <div class="card"><div class="card-body pt-3">
      <ul class="nav nav-pills mb-3">
        <li class="nav-item"><a class="nav-link" [class.active]="status === 'PENDING'" role="button" (click)="setStatus('PENDING')" data-testid="la-tab-pending">Waiting <span class="badge bg-danger ms-1" *ngIf="pending">{{pending}}</span></a></li>
        <li class="nav-item"><a class="nav-link" [class.active]="status === 'APPROVED'" role="button" (click)="setStatus('APPROVED')" data-testid="la-tab-approved">Approved</a></li>
        <li class="nav-item"><a class="nav-link" [class.active]="status === 'REJECTED'" role="button" (click)="setStatus('REJECTED')" data-testid="la-tab-rejected">Declined</a></li>
      </ul>
      <div *ngIf="message" class="alert alert-success py-2" data-testid="la-message">{{message}}</div>
      <div *ngIf="error" class="alert alert-danger py-2" data-testid="la-error">{{error}}</div>
      <div *ngIf="deciding" class="border rounded p-2 mb-3" data-testid="la-decide-form">
        <div class="row g-2 align-items-end">
          <div class="col-md-8"><label class="form-label">{{deciding.action === 'reject' ? 'Why is it declined? *' : 'Note (optional)'}}</label><input class="form-control form-control-sm" maxlength="200" [(ngModel)]="deciding.note" data-testid="la-note"></div>
          <div class="col-md-4"><button class="btn btn-sm" [ngClass]="deciding.action === 'reject' ? 'btn-danger' : 'btn-success'" type="button" (click)="confirm()" data-testid="la-confirm">{{deciding.action === 'reject' ? 'Decline' : 'Approve'}}</button>
            <button class="btn btn-outline-secondary btn-sm ms-1" type="button" (click)="deciding = null">Cancel</button></div>
        </div>
      </div>
      <table class="table table-sm align-middle" data-testid="la-table">
        <thead><tr><th>Who</th><th>Leave</th><th class="text-end">Days</th><th>Reason</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows" data-testid="la-row" [attr.data-id]="r.id">
            <td>{{r.name}}<div class="small text-muted">{{r.designation}}</div></td>
            <td>{{r.type}}{{r.paid ? '' : ' (unpaid)'}}<div class="small text-muted">{{r.from_date | date:'dd MMM'}}<span *ngIf="r.to_date !== r.from_date"> - {{r.to_date | date:'dd MMM yyyy'}}</span><span *ngIf="r.half_day"> · half day</span></div></td>
            <td class="text-end">{{r.days}}<div class="small text-muted" *ngIf="r.left_days !== null">{{r.left_days}} left</div></td>
            <td>{{r.reason}}<div class="small text-muted" *ngIf="r.decision_note">{{r.decision_note}}</div></td>
            <td class="text-end text-nowrap">
              <ng-container *ngIf="r.status === 'PENDING'">
                <button class="btn btn-success btn-sm" type="button" (click)="start(r, 'approve')" data-testid="la-approve">Approve</button>
                <button class="btn btn-outline-danger btn-sm ms-1" type="button" (click)="start(r, 'reject')" data-testid="la-reject">Decline</button>
              </ng-container>
              <span class="small text-muted" *ngIf="r.status !== 'PENDING'">{{r.decided_by_name}}</span>
            </td>
          </tr>
          <tr *ngIf="!rows.length"><td colspan="5" class="text-center text-muted py-3">Nothing here.</td></tr>
        </tbody>
      </table>
    </div></div>`,
})
export class LeaveApprovalsComponent implements OnInit {
  status = "PENDING";
  rows: any[] = [];
  pending = 0;
  message = "";
  error = "";
  deciding: { id: number; action: string; note: string } | null = null;

  constructor(private api: MyHrApi) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.approvalList(this.status).subscribe(r => this.rows = r, e => this.error = this.api.msg(e));
    this.api.approvalCount().subscribe(c => this.pending = c.n);
  }

  setStatus(s: string) { this.status = s; this.deciding = null; this.load(); }
  start(r: any, action: string) { this.message = this.error = ""; this.deciding = { id: r.id, action, note: "" }; }

  confirm() {
    const d = this.deciding!;
    this.api.decide(d.id, { action: d.action, note: d.note }).subscribe(
      () => { this.message = d.action === "approve" ? "Approved." : "Declined."; this.deciding = null; this.load(); },
      e => this.error = this.api.msg(e));
  }
}
