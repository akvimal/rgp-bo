import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { AuthService } from "src/app/@core/auth/auth.service";

/**
 * A completed bill becomes a delivery (or goes back to a counter sale) after it was rung. The money does not change: the bill was paid, or left to
 * pay later, when it was made, so the delivery is booked as already collected. The server decides who may and when; this only asks for the details.
 */
@Component({
  selector: "app-sale-delivery-mode",
  template: `
    <p-dialog [header]="(toDelivery ? 'Make bill ' : 'Change bill ') + (sale?.billno || '') + (toDelivery ? ' a delivery' : ' to a counter sale')" [visible]="!!sale"
              (visibleChange)="!$event && close()" [modal]="true" [style]="{width: '36rem'}" [draggable]="false">
      <div *ngIf="sale" data-testid="dmode">
        <p class="small text-muted mb-2" *ngIf="toDelivery">The bill is already paid (or left to pay later), so nothing is collected at the door. The delivery appears in the Deliveries list.</p>
        <p class="small text-muted mb-2" *ngIf="!toDelivery">The delivery record is removed and the bill goes back to a counter sale. A delivery already marked delivered cannot be changed back.</p>
        <div class="alert alert-danger py-2" *ngIf="error" data-testid="dmode-error">{{error}}</div>

        <div class="row g-2" *ngIf="toDelivery">
          <div class="col-6"><label class="form-label">Receiver name</label><input class="form-control" maxlength="80" [(ngModel)]="d.receivername" placeholder="the customer on the bill" data-testid="dmode-name"></div>
          <div class="col-6"><label class="form-label">Receiver phone</label><input class="form-control" maxlength="20" [(ngModel)]="d.receiverphone" data-testid="dmode-phone"></div>
          <div class="col-12"><label class="form-label">Address</label><textarea class="form-control" rows="2" maxlength="250" [(ngModel)]="d.receiveraddress" data-testid="dmode-address"></textarea></div>
          <div class="col-6"><label class="form-label">Method</label>
            <select class="form-select" [(ngModel)]="d.deliverymethod" data-testid="dmode-method"><option value="Staff Delivery">Staff Delivery</option><option value="Courier">Courier</option></select></div>
          <div class="col-6" *ngIf="d.deliverymethod === 'Courier'"><label class="form-label">Courier partner</label>
            <select class="form-select" [(ngModel)]="d.courierpartner"><option value="">Select partner</option><option *ngFor="let p of partners" [value]="p.name">{{p.name}}</option></select></div>
          <div class="col-6" *ngIf="d.deliverymethod !== 'Courier'"><label class="form-label">Delivered by</label><input class="form-control" maxlength="60" [(ngModel)]="d.deliveryby" data-testid="dmode-by"></div>
          <div class="col-6"><label class="form-label">Delivery charge (&#8377;)</label><input type="number" min="0" class="form-control" [(ngModel)]="d.charges" data-testid="dmode-charges"></div>
          <div class="col-12 form-check ms-2"><input class="form-check-input" type="checkbox" id="dmDelivered" [(ngModel)]="d.delivered" data-testid="dmode-delivered"><label class="form-check-label" for="dmDelivered">Already delivered</label></div>
          <div class="col-12 form-check ms-2" *ngIf="auth.gstLive"><input class="form-check-input" type="checkbox" id="dmOutside" [(ngModel)]="outsidestate" data-testid="dmode-outside"><label class="form-check-label" for="dmOutside">Delivered to another state</label>
            <div class="small text-muted">That changes the tax on the bill, so it cannot be done from here.</div></div>
        </div>

        <div class="mt-2">
          <label class="form-label">Why <span class="text-muted small">(needed once the shift is closed, or for someone else's bill)</span></label>
          <input class="form-control" maxlength="200" [(ngModel)]="reason" placeholder="e.g. the customer asked us to send it" data-testid="dmode-reason">
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="btn btn-outline-secondary" (click)="close()" [disabled]="busy">Cancel</button>
        <button type="button" class="btn btn-primary ms-2" (click)="save()" [disabled]="busy" data-testid="dmode-save">{{toDelivery ? 'Make it a delivery' : 'Change to counter sale'}}</button>
      </ng-template>
    </p-dialog>`
})
export class SaleDeliveryModeComponent implements OnChanges {
  /** the bill row being changed (null = closed) */
  @Input() sale: any = null;
  @Output() closed = new EventEmitter<boolean>();

  d: any = {};
  reason = "";
  outsidestate = false;
  error = "";
  busy = false;
  partners: any[] = [];

  constructor(private http: HttpClient, public auth: AuthService) {}

  get toDelivery(): boolean { return (this.sale?.deliverytype || "Counter") !== "Delivery"; }

  ngOnChanges(c: SimpleChanges) {
    if (c["sale"] && this.sale) {
      this.d = { deliverymethod: "Staff Delivery", charges: 0, delivered: false };
      this.reason = ""; this.outsidestate = false; this.error = ""; this.busy = false;
      if (!this.partners.length) this.http.get<any[]>(`${environment.apiHost}/delivery-partners`).subscribe(p => this.partners = p || [], () => this.partners = []);
    }
  }

  close(changed = false) { this.closed.emit(changed); }

  save() {
    this.error = ""; this.busy = true;
    const body: any = { type: this.toDelivery ? "Delivery" : "Counter", reason: this.reason.trim() || undefined, outsidestate: this.outsidestate || undefined };
    if (this.toDelivery) body.delivery = this.d;
    this.http.post<any>(`${environment.apiHost}/deliveries/mode/${this.sale.id}`, body).subscribe(
      () => { this.busy = false; this.close(true); },
      e => { this.busy = false; const m = e?.error?.message; this.error = Array.isArray(m) ? m.join(" ") : (m || "Could not change the bill."); });
  }
}
