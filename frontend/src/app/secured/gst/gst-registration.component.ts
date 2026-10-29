import { Component, OnInit } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";
import { isValidGstin, stateName } from "../purchases/vendors/gst-util";
import { GstApiService } from "./gst-api.service";

/**
 * Whether the business is on GST and from when. Two kinds: not registered (cash memos, no tax), and registered and filing (tax invoices in a numbered series
 * from the go-live date). Nothing before the go-live date is changed.
 */
@Component({
  selector: "app-gst-registration",
  template: `
  <p class="small text-muted" data-testid="reg-intro">
    A business that is not registered gives cash memos with no tax shown. A registered business gives tax invoices, numbered in a series for the financial year,
    from the go-live date. Bills before that date stay as they were.
  </p>
  <div class="alert alert-danger py-2" *ngIf="error" data-testid="reg-error">{{error}}</div>
  <div class="alert alert-success py-2" *ngIf="message" data-testid="reg-message">{{message}}</div>

  <div *ngIf="reg" class="row g-4">
    <div class="col-lg-6">
      <div class="form-check"><input class="form-check-input" type="radio" id="reg-none" name="regtype" value="none" [(ngModel)]="form.reg_type" data-testid="reg-none">
        <label class="form-check-label" for="reg-none"><strong>Not registered</strong><span class="d-block small text-muted">Cash memos. No tax on the bill.</span></label></div>
      <div class="form-check mt-2"><input class="form-check-input" type="radio" id="reg-yes" name="regtype" value="registered" [(ngModel)]="form.reg_type" data-testid="reg-yes">
        <label class="form-check-label" for="reg-yes"><strong>Registered and filing</strong><span class="d-block small text-muted">Tax invoices from the go-live date; the register and monthly summary for your auditor.</span></label></div>

      <div class="row g-2 mt-2" *ngIf="form.reg_type === 'registered'" data-testid="reg-fields">
        <div class="col-12">
          <label class="form-label">GSTIN</label>
          <input class="form-control" style="text-transform:uppercase" maxlength="15" [(ngModel)]="form.gstin" [disabled]="lockedRegistration" data-testid="reg-gstin">
          <div class="small" [ngClass]="gstinOk ? 'text-success' : 'text-danger'" *ngIf="form.gstin">{{gstinOk ? 'Valid. State: ' + state : 'Not a valid GSTIN: check the 15 characters, the state code and the check digit.'}}</div>
        </div>
        <div class="col-6">
          <label class="form-label">Tax invoices from</label>
          <input type="date" class="form-control" [(ngModel)]="form.go_live" [disabled]="lockedRegistration" data-testid="reg-golive">
        </div>
        <div class="col-6">
          <label class="form-label">Invoice prefix</label>
          <input class="form-control" style="text-transform:uppercase" maxlength="3" [(ngModel)]="form.invoice_prefix" data-testid="reg-prefix">
          <div class="form-text">2 or 3 letters. Numbers look like {{form.invoice_prefix || 'INV'}}/{{fyShort}}/000001.</div>
        </div>
        <div class="col-12 small text-muted" *ngIf="lockedRegistration" data-testid="reg-locked">Tax invoices were issued under this GSTIN from this date, so neither can be changed. {{reg.invoices_issued}} issued; the last is {{reg.last_invoice}}.</div>
      </div>

      <div class="alert alert-warning py-2 mt-3" *ngIf="form.reg_type === 'none' && reg.reg_type === 'registered'" data-testid="reg-cancel-warn">
        Going back to not registered stops tax invoices from now. Earlier invoices stay as they are.
        <div class="form-check mt-1"><input class="form-check-input" type="checkbox" id="reg-conf" [(ngModel)]="confirmCancel" data-testid="reg-confirm"><label class="form-check-label" for="reg-conf">I am no longer registered</label></div>
      </div>

      <div class="row g-2 mt-2">
        <div class="col-12 col-md-6" *ngIf="form.reg_type === 'registered'">
          <label class="form-label">HSN digits on the return</label>
          <select class="form-select" [(ngModel)]="form.hsn_digits" data-testid="reg-digits">
            <option [ngValue]="4">4 digits</option><option [ngValue]="6">6 digits</option><option [ngValue]="8">8 digits</option>
          </select>
          <div class="form-text">The HSN summary lists codes shorter than this. Choose what your return needs for your turnover.</div>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label">Registration limit for the year (&#8377;)</label>
          <input type="number" min="1" class="form-control" [(ngModel)]="form.turnover_limit" data-testid="reg-limit">
          <div class="form-text">Used to warn a business that is not registered. Set it to the limit that applies to you.</div>
        </div>
      </div>
      <button class="btn btn-primary mt-3" type="button" [disabled]="busy" (click)="save()" data-testid="reg-save">Save</button>
    </div>

    <div class="col-lg-6">
      <h6 class="text-primary">Where you stand</h6>
      <table class="table table-sm" data-testid="reg-status">
        <tbody>
          <tr><td>Status</td><td>{{reg.reg_type === 'registered' ? (reg.live ? 'Registered: tax invoices are being issued' : 'Registered: tax invoices start on ' + (reg.go_live | date:'dd MMM yyyy')) : 'Not registered'}}</td></tr>
          <tr *ngIf="reg.gstin"><td>GSTIN on file</td><td>{{reg.gstin}} <span class="text-muted">({{stateOf(reg.gstin)}})</span></td></tr>
          <tr><td>Sales this financial year ({{reg.fy_from | date:'dd MMM yyyy'}} to {{reg.fy_to | date:'dd MMM yyyy'}})</td><td class="text-end">&#8377;{{reg.turnover_fy | number:'1.0-0'}}</td></tr>
          <tr *ngIf="reg.reg_type === 'none'"><td>Against the limit of &#8377;{{reg.turnover_limit | number:'1.0-0'}}</td>
            <td class="text-end"><span class="badge" [ngClass]="reg.watch === 'over' ? 'bg-danger' : reg.watch === 'near' ? 'bg-warning text-dark' : 'bg-success'" data-testid="reg-watch">{{reg.turnover_pct}}%</span></td></tr>
          <tr *ngIf="reg.invoices_issued"><td>Tax invoices issued</td><td class="text-end">{{reg.invoices_issued}}</td></tr>
        </tbody>
      </table>
      <div class="alert alert-warning py-2 small" *ngIf="reg.reg_type === 'none' && reg.watch === 'near'" data-testid="reg-near">Sales are close to the registration limit. Talk to your auditor about registering before it is crossed.</div>
      <div class="alert alert-danger py-2 small" *ngIf="reg.reg_type === 'none' && reg.watch === 'over'" data-testid="reg-over">Sales have passed the registration limit for this year. Registration may already be due: ask your auditor.</div>
    </div>
  </div>
  `,
})
export class GstRegistrationComponent implements OnInit {
  reg: any = null;
  form: any = { reg_type: 'none', gstin: '', go_live: '', invoice_prefix: 'INV', turnover_limit: 0, hsn_digits: 4 };
  confirmCancel = false;
  busy = false;
  error = "";
  message = "";

  constructor(private api: GstApiService, private auth: AuthService) {}

  ngOnInit() { this.load(); }

  get gstinOk() { return isValidGstin(this.form.gstin); }
  get state() { return stateName(String(this.form.gstin || '').slice(0, 2)); }
  stateOf(g: string) { return stateName(String(g || '').slice(0, 2)); }
  get lockedRegistration() { return this.reg?.reg_type === 'registered' && this.reg?.invoices_issued > 0; }
  get fyShort() { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; const yy = (n: number) => String(n % 100).padStart(2, '0'); return `${yy(y)}-${yy(y + 1)}`; }

  load() {
    this.api.registration().subscribe((r: any) => {
      this.reg = r;
      this.form = { reg_type: r.reg_type, gstin: r.gstin || '', go_live: r.go_live || '', invoice_prefix: r.invoice_prefix, turnover_limit: r.turnover_limit, hsn_digits: r.hsn_digits || 4 };
      this.confirmCancel = false;
    }, (e) => this.fail(e, 'Could not load the registration.'));
  }

  private fail(e: any, fallback: string) { this.error = e?.error?.message || fallback; this.message = ''; this.busy = false; }

  save() {
    this.error = this.message = ''; this.busy = true;
    const f = this.form;
    const body: any = { reg_type: f.reg_type, invoice_prefix: f.invoice_prefix, turnover_limit: +f.turnover_limit, hsn_digits: +f.hsn_digits || 4 };
    if (f.reg_type === 'registered') { body.gstin = String(f.gstin || '').trim().toUpperCase(); body.go_live = f.go_live; }
    else body.confirm_cancelled = this.confirmCancel;
    this.api.saveRegistration(body).subscribe((r: any) => {
      this.busy = false; this.message = 'Saved.';
      this.auth.setGst({ registered: r.reg_type === 'registered', go_live: r.go_live, state_code: r.state_code });
      this.reg = r; this.load();
    }, (e) => this.fail(e, 'Could not save.'));
  }
}
