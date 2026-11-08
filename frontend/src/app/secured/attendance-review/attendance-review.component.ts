import { Component, OnDestroy, OnInit } from "@angular/core";
import { AttendanceApi } from "../attendance/attendance.service";

/**
 * Attendance review: each day of the people who punch, with their photos. Approve a day, or change it with a reason;
 * a day with no punch is settled too. Payroll waits until every day before today is reviewed. The PINs tab sets who punches.
 */
@Component({
  selector: "app-attendance-review",
  template: `
    <div class="pagetitle"><h1>Attendance review</h1></div>
    <div class="card"><div class="card-body pt-3">
      <ul class="nav nav-pills mb-3">
        <li class="nav-item"><a class="nav-link" [class.active]="tab === 'days'" role="button" (click)="tab = 'days'" data-testid="ar-tab-days">Days
          <span class="badge bg-danger ms-1" *ngIf="pending + missing">{{pending + missing}}</span></a></li>
        <li class="nav-item"><a class="nav-link" [class.active]="tab === 'pins'" role="button" (click)="openPins()" data-testid="ar-tab-pins">Who punches (PINs)</a></li>
      </ul>
      <div *ngIf="message" class="alert alert-success py-2" data-testid="ar-message">{{message}}</div>
      <div *ngIf="error" class="alert alert-danger py-2" data-testid="ar-error">{{error}}</div>

      <ng-container *ngIf="tab === 'days'">
        <div class="row g-2 align-items-end mb-3">
          <div class="col-auto"><label class="form-label mb-0">Month</label><input type="month" class="form-control form-control-sm" [(ngModel)]="period" (change)="load()" data-testid="ar-period"></div>
          <div class="col-auto"><label class="form-label mb-0">Show</label>
            <select class="form-select form-select-sm" [(ngModel)]="status" (change)="load()" data-testid="ar-status"><option value="pending">Needs review</option><option value="all">All days</option></select></div>
          <div class="col text-muted small">{{pending}} to approve, {{missing}} with no punch. Payroll waits until these are done.</div>
        </div>
        <div class="text-muted" *ngIf="!items.length" data-testid="ar-empty">Nothing to review.</div>
        <div class="border rounded p-2 mb-2" *ngFor="let i of items" data-testid="ar-item" [attr.data-type]="i.type" [attr.data-emp]="i.employee_id" [attr.data-date]="i.date">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <div style="min-width:180px"><strong>{{i.name}}</strong><div class="small text-muted">{{i.store}}</div></div>
            <div style="min-width:120px">{{i.date | date:'EEE d MMM'}}</div>
            <div class="flex-grow-1">
              <ng-container *ngIf="i.type === 'MISSING'"><span class="badge bg-danger">No punch</span> <span class="text-muted small">did they come in?</span></ng-container>
              <ng-container *ngIf="i.type !== 'MISSING'">
                <span class="badge" [ngClass]="i.status === 'PRESENT' ? 'bg-success' : i.status === 'ABSENT' ? 'bg-danger' : 'bg-secondary'">{{label(i.status)}}</span>
                <span class="ms-2">{{i.check_in || '--'}} to {{i.check_out || '--'}}</span>
                <span class="badge bg-warning text-dark ms-1" *ngIf="i.flags.includes('LATE')">Late</span>
                <span class="badge bg-warning text-dark ms-1" *ngIf="i.flags.includes('EARLY_OUT')">Early out</span>
                <span class="badge bg-danger ms-1" *ngIf="i.type === 'PENDING' && !i.check_out">No Out</span>
                <span class="badge bg-info text-dark ms-1" *ngIf="i.verification === 'CORRECTED'">Changed</span>
                <span class="badge bg-light text-dark border ms-1" *ngIf="i.verification === 'VERIFIED'">Approved</span>
                <span class="badge bg-light text-dark border ms-1" *ngIf="i.type === 'TODAY'">Today, not due yet</span>
                <div class="small text-muted" *ngIf="i.note">{{i.note}}</div>
              </ng-container>
            </div>
            <div class="text-nowrap">
              <button class="btn btn-outline-secondary btn-sm me-1" type="button" *ngIf="i.punches.length" (click)="togglePhotos(i)" data-testid="ar-photos"><i class="bi bi-camera"></i> Photos</button>
              <button class="btn btn-success btn-sm me-1" type="button" *ngIf="i.type === 'PENDING'" (click)="edit(i, 'APPROVE')" data-testid="ar-approve">Approve</button>
              <button class="btn btn-outline-primary btn-sm" type="button" (click)="edit(i, 'SET')" data-testid="ar-change">{{i.type === 'MISSING' ? 'Mark' : 'Change'}}</button>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-3 mt-2" *ngIf="i.showPhotos">
            <div *ngFor="let p of i.punches" class="text-center">
              <img *ngIf="photoUrl[p.id]" [src]="photoUrl[p.id]" style="width:200px;border-radius:6px" [alt]="p.kind + ' ' + p.time" data-testid="ar-photo">
              <div class="small text-muted" *ngIf="!p.photo">Photo removed after the retention period</div>
              <div class="small">{{p.kind === 'IN' ? 'In' : 'Out'}} {{p.time}}</div>
            </div>
          </div>
          <div class="border-top mt-2 pt-2" *ngIf="editing && editing.item === i" data-testid="ar-form">
            <div class="row g-2 align-items-end">
              <div class="col-auto" *ngIf="i.type === 'PENDING'">
                <div class="btn-group btn-group-sm"><button type="button" class="btn" [ngClass]="editing.action === 'APPROVE' ? 'btn-success' : 'btn-outline-success'" (click)="editing.action = 'APPROVE'">Approve</button>
                  <button type="button" class="btn" [ngClass]="editing.action === 'SET' ? 'btn-primary' : 'btn-outline-primary'" (click)="editing.action = 'SET'">Change</button></div>
              </div>
              <div class="col-auto" *ngIf="editing.action === 'SET'"><label class="form-label mb-0">Day is</label>
                <select class="form-select form-select-sm" [(ngModel)]="editing.status" data-testid="ar-set-status"><option value="PRESENT">Present</option><option value="HALF_DAY">Half day</option><option value="ABSENT">Absent</option></select></div>
              <div class="col-auto"><label class="form-label mb-0">In</label><input type="time" class="form-control form-control-sm" [(ngModel)]="editing.check_in" data-testid="ar-in"></div>
              <div class="col-auto"><label class="form-label mb-0">Out</label><input type="time" class="form-control form-control-sm" [(ngModel)]="editing.check_out" data-testid="ar-out"></div>
              <div class="col"><label class="form-label mb-0">{{editing.action === 'SET' ? 'Why? *' : 'Note (needed if there is no Out)'}}</label>
                <input class="form-control form-control-sm" maxlength="200" [(ngModel)]="editing.note" data-testid="ar-note"></div>
              <div class="col-auto"><button class="btn btn-sm btn-primary" type="button" (click)="save()" data-testid="ar-save">Save</button>
                <button class="btn btn-sm btn-outline-secondary ms-1" type="button" (click)="editing = null">Cancel</button></div>
            </div>
            <div class="small text-muted mt-1">Leave blank to keep the punched time. Times are India time.</div>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="tab === 'pins'">
        <div class="alert alert-info py-2" *ngIf="newPin" data-testid="ar-newpin">PIN for <strong>{{newPin.name}}</strong>: <strong class="fs-5">{{newPin.pin}}</strong>. Tell them privately; it is not shown again.</div>
        <p class="text-muted small">Only people switched on here appear on the store PC&#39;s attendance screen. A PIN is 4 to 6 digits. Five wrong tries lock it for 10 minutes.</p>
        <table class="table table-sm align-middle" data-testid="ar-people">
          <thead><tr><th>Staff</th><th>Store</th><th>Punching</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let p of people" data-testid="ar-person" [attr.data-id]="p.id">
              <td>{{p.name}}<div class="small text-muted">{{p.designation}}</div></td>
              <td>{{p.store}}</td>
              <td><span class="badge" [ngClass]="p.enabled ? 'bg-success' : 'bg-secondary'">{{p.enabled ? 'On' : 'Off'}}</span>
                <span class="badge bg-warning text-dark ms-1" *ngIf="p.locked">Locked</span></td>
              <td class="text-end text-nowrap">
                <ng-container *ngIf="pinFor !== p.id">
                  <button class="btn btn-sm btn-outline-primary" type="button" (click)="generate(p)" data-testid="ar-generate">{{p.enabled ? 'New PIN / unlock' : 'Switch on'}}</button>
                  <button class="btn btn-sm btn-outline-secondary ms-1" type="button" (click)="pinFor = p.id; pinValue = ''">Set PIN</button>
                  <button class="btn btn-sm btn-outline-danger ms-1" type="button" *ngIf="p.enabled" (click)="turnOff(p)">Switch off</button>
                </ng-container>
                <ng-container *ngIf="pinFor === p.id">
                  <input class="form-control form-control-sm d-inline-block" style="width:110px" maxlength="6" inputmode="numeric" placeholder="4-6 digits" [(ngModel)]="pinValue" data-testid="ar-pin-input">
                  <button class="btn btn-sm btn-primary ms-1" type="button" (click)="setPin(p)" data-testid="ar-pin-save">Save</button>
                  <button class="btn btn-sm btn-outline-secondary ms-1" type="button" (click)="pinFor = null">Cancel</button>
                </ng-container>
              </td>
            </tr>
          </tbody>
        </table>
      </ng-container>
    </div></div>`,
})
export class AttendanceReviewComponent implements OnInit, OnDestroy {
  tab: "days" | "pins" = "days";
  period = new Date().toISOString().slice(0, 7);
  status = "pending";
  items: any[] = [];
  pending = 0;
  missing = 0;
  message = "";
  error = "";
  editing: any = null;
  photoUrl: { [id: number]: string } = {};
  people: any[] = [];
  pinFor: number | null = null;
  pinValue = "";
  newPin: { name: string; pin: string } | null = null;

  constructor(private api: AttendanceApi) {}

  ngOnInit() { this.load(); }
  ngOnDestroy() { Object.values(this.photoUrl).forEach(u => URL.revokeObjectURL(u)); }

  label(s: string) { return s === "PRESENT" ? "Present" : s === "ABSENT" ? "Absent" : s === "HALF_DAY" ? "Half day" : s; }

  load() {
    this.error = "";
    this.api.list(this.period, this.status).subscribe(
      (r: any) => { this.items = r.items; this.pending = r.pending; this.missing = r.missing; this.editing = null; },
      e => (this.error = this.api.msg(e)));
  }

  togglePhotos(i: any) {
    i.showPhotos = !i.showPhotos;
    if (!i.showPhotos) return;
    for (const p of i.punches) {
      if (!p.photo || this.photoUrl[p.id]) continue;
      this.api.photo(p.id).subscribe(b => (this.photoUrl[p.id] = URL.createObjectURL(b)), () => (p.photo = false));
    }
  }

  edit(i: any, action: string) {
    this.message = this.error = "";
    this.editing = { item: i, action, status: i.type === "MISSING" ? "PRESENT" : (i.status || "PRESENT"), check_in: "", check_out: "", note: "" };
  }

  save() {
    const e = this.editing;
    if (!e) return;
    this.message = this.error = "";
    const body: any = { employee_id: e.item.employee_id, date: e.item.date, action: e.action, status: e.status, note: e.note,
      check_in: e.check_in || undefined, check_out: e.check_out || undefined };
    this.api.day(body).subscribe(
      () => { this.message = e.action === "APPROVE" ? "Approved." : "Saved."; this.load(); },
      err => (this.error = this.api.msg(err)));
  }

  // ---------------------------------------------------------------- PINs
  openPins() { this.tab = "pins"; this.message = this.error = ""; this.loadPeople(); }
  loadPeople() { this.api.people().subscribe(p => (this.people = p), e => (this.error = this.api.msg(e))); }

  private done(p: any, r: any, text: string) {
    this.message = text;
    this.newPin = r?.pin ? { name: p.name, pin: r.pin } : null;
    this.pinFor = null;
    this.loadPeople();
  }
  generate(p: any) { this.message = this.error = ""; this.api.setPin(p.id, { generate: true }).subscribe(r => this.done(p, r, "Done."), e => (this.error = this.api.msg(e))); }
  setPin(p: any) { this.message = this.error = ""; this.api.setPin(p.id, { pin: this.pinValue }).subscribe(r => this.done(p, r, "PIN saved."), e => (this.error = this.api.msg(e))); }
  turnOff(p: any) { this.message = this.error = ""; this.api.setPin(p.id, { enabled: false }).subscribe(r => this.done(p, r, "Switched off."), e => (this.error = this.api.msg(e))); }
}
