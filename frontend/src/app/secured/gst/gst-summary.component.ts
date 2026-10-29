import { Component, OnInit } from "@angular/core";
import { GstApiService } from "./gst-api.service";

/**
 * The monthly routine: the output tax against the input credit, the HSN summary with what still needs a decision, and closing the month once the return
 * is filed (the ARN is typed in; the month is then locked and its figures are kept as they stood).
 */
@Component({
  selector: "app-gst-summary",
  template: `
  <div class="alert alert-danger py-2" *ngIf="error" data-testid="gsm-error">{{error}}</div>
  <div class="alert alert-success py-2" *ngIf="message" data-testid="gsm-message">{{message}}</div>

  <h6 class="text-primary">Months</h6>
  <table class="table table-sm" data-testid="gsm-months" *ngIf="months">
    <thead><tr><th>Month</th><th class="text-end">Tax invoices</th><th>Usual dates (check yours)</th><th>State</th><th></th></tr></thead>
    <tbody>
      <tr *ngFor="let m of months" [class.table-active]="m.month === month" data-testid="gsm-month-row">
        <td>{{m.label}}</td><td class="text-end">{{m.invoices}}</td>
        <td class="small"><span *ngIf="registered">GSTR-1 by {{m.due_gstr1 | date:'dd MMM'}}, GSTR-3B by {{m.due_gstr3b | date:'dd MMM'}}</span><span *ngIf="!registered" class="text-muted">no return to file</span></td>
        <td><span class="badge" [ngClass]="m.closed ? 'bg-success' : (m.over && registered) ? 'bg-warning text-dark' : 'bg-secondary'">{{m.closed ? 'closed' + (m.arn ? ' ' + m.arn : '') : !registered ? 'not registered' : m.over ? 'to file' : 'running'}}</span></td>
        <td class="text-end"><button class="btn btn-sm btn-outline-primary" type="button" (click)="open(m.month)" data-testid="gsm-open">Open</button></td>
      </tr>
    </tbody>
  </table>

  <div *ngIf="sum" data-testid="gsm-box">
    <h6 class="text-primary mt-3">{{sum.label}}</h6>
    <div class="row g-4">
      <div class="col-lg-6">
        <table class="table table-sm" data-testid="gsm-output">
          <thead><tr><th>Output tax (tax invoices less credit notes)</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th><th class="text-end">Tax</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of sum.output_by_rate"><td>{{r.rate}}%</td><td class="text-end">{{r.taxable | number:'1.2-2'}}</td><td class="text-end">{{r.cgst | number:'1.2-2'}}</td><td class="text-end">{{r.sgst | number:'1.2-2'}}</td><td class="text-end">{{r.igst | number:'1.2-2'}}</td><td class="text-end">{{r.tax | number:'1.2-2'}}</td></tr>
            <tr *ngIf="!sum.output_by_rate.length"><td colspan="6" class="text-muted">No tax invoices.</td></tr>
            <tr class="fw-semibold"><td>Total</td><td class="text-end">{{sum.output.taxable | number:'1.2-2'}}</td><td class="text-end">{{sum.output.cgst | number:'1.2-2'}}</td><td class="text-end">{{sum.output.sgst | number:'1.2-2'}}</td><td class="text-end">{{sum.output.igst | number:'1.2-2'}}</td><td class="text-end">{{sum.output.tax | number:'1.2-2'}}</td></tr>
          </tbody>
        </table>
        <table class="table table-sm w-auto" data-testid="gsm-result">
          <tbody>
            <tr><td>Output tax</td><td class="text-end">&#8377;{{sum.output.tax | number:'1.2-2'}}</td></tr>
            <tr><td>Input credit claimable (matched purchases)</td><td class="text-end">&#8377;{{sum.itc.claimable | number:'1.2-2'}}</td></tr>
            <tr class="fw-semibold" *ngIf="sum.payable > 0"><td>Tax payable</td><td class="text-end" data-testid="gsm-payable">&#8377;{{sum.payable | number:'1.2-2'}}</td></tr>
            <tr class="fw-semibold" *ngIf="sum.payable === 0"><td>Credit to carry forward</td><td class="text-end" data-testid="gsm-carry">&#8377;{{sum.carry_forward | number:'1.2-2'}}</td></tr>
          </tbody>
        </table>
        <div class="small text-muted" *ngIf="!sum.itc.reconciled" data-testid="gsm-noitc">No GSTR-2B has been loaded for this month, so no input credit is counted. Load it under Purchase &gt; GST.</div>
        <div class="small text-muted" *ngIf="sum.itc.reconciled">Credit on hold (mismatches and disputes): &#8377;{{sum.itc.on_hold | number:'1.2-2'}}. In 2B but not in your books: see Purchase &gt; GST.</div>
      </div>

      <div class="col-lg-6">
        <div class="alert py-2 small" [ngClass]="sum.issues.hsn.clean ? 'alert-success' : 'alert-warning'" data-testid="gsm-hsn-issues">
          <span *ngIf="sum.issues.hsn.clean">The HSN summary is complete.</span>
          <span *ngIf="!sum.issues.hsn.clean">HSN to look at: <strong>{{sum.issues.hsn.unknown_rows}}</strong> with no HSN, <strong>{{sum.issues.hsn.provisional_rows}}</strong> on a provisional category code, <strong>{{sum.issues.hsn.short_rows}}</strong> shorter than {{sum.issues.hsn.digits}} digits. Fix them under the HSN codes tab, or accept them as they are when you close the month.</span>
        </div>
        <div class="alert alert-warning py-2 small" *ngIf="sum.issues.gaps.length">Numbers missing from the invoice series: {{sum.issues.gaps.join(', ')}}.</div>

        <div *ngIf="sum.closed" class="alert alert-success py-2" data-testid="gsm-closed">
          Closed{{sum.closed.filed_on ? ': filed on ' + (sum.closed.filed_on | date:'dd MMM yyyy') : ''}}{{sum.closed.arn ? ', ARN ' + sum.closed.arn : ''}}. Tax invoices can no longer be dated in this month.
          <div class="mt-2 d-flex gap-2"><input class="form-control form-control-sm" placeholder="Why reopen it" [(ngModel)]="reason" data-testid="gsm-reason"><button class="btn btn-sm btn-outline-danger text-nowrap" type="button" (click)="reopen()" data-testid="gsm-reopen">Reopen</button></div>
        </div>

        <div *ngIf="!sum.closed && canClose" data-testid="gsm-close-form">
          <h6 class="text-primary">Close the month</h6>
          <p class="small text-muted">After the return is filed, enter the date and the ARN. The month is then locked and these figures are kept as they stand.</p>
          <div class="row g-2">
            <div class="col-6"><label class="form-label">Filed on</label><input type="date" class="form-control" [(ngModel)]="filedOn" data-testid="gsm-filed"></div>
            <div class="col-6"><label class="form-label">ARN</label><input class="form-control" style="text-transform:uppercase" maxlength="30" [(ngModel)]="arn" data-testid="gsm-arn"></div>
            <div class="col-12" *ngIf="!sum.issues.hsn.clean"><div class="form-check"><input class="form-check-input" type="checkbox" id="gsm-acc" [(ngModel)]="acceptHsn" data-testid="gsm-accept"><label class="form-check-label" for="gsm-acc">I accept the HSN codes as they stand (no HSN, provisional or short)</label></div></div>
            <div class="col-12"><button class="btn btn-primary" type="button" [disabled]="busy" (click)="close()" data-testid="gsm-close">Close {{sum.label}}</button></div>
          </div>
        </div>
        <div class="small text-muted" *ngIf="!sum.closed && !canClose" data-testid="gsm-cannot">{{!sum.registered ? 'A month is closed only by a registered business.' : 'A month can be closed once it is over.'}}</div>
      </div>
    </div>

    <h6 class="text-primary mt-4">HSN summary <span class="small text-muted" *ngIf="hsn?.snapshot">(as it stood when the month was closed)</span></h6>
    <div class="table-responsive" style="max-height:20rem" *ngIf="hsn">
      <table class="table table-sm table-striped" data-testid="gsm-hsn">
        <thead><tr><th>HSN</th><th>Status</th><th class="text-end">GST</th><th class="text-end">Quantity</th><th class="text-end">Taxable</th><th class="text-end">Tax</th><th class="text-end">Products</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of hsn.rows"><td>{{r.hsn || 'not known'}}</td>
            <td><span class="badge" [ngClass]="r.source === 'own' ? 'bg-success' : r.source === 'category' ? 'bg-warning text-dark' : 'bg-danger'">{{r.source === 'own' ? 'own' : r.source === 'category' ? 'provisional' : 'unknown'}}</span></td>
            <td class="text-end">{{r.rate}}%</td><td class="text-end">{{r.qty | number:'1.0-0'}}</td><td class="text-end">{{r.taxable | number:'1.2-2'}}</td><td class="text-end">{{r.tax | number:'1.2-2'}}</td><td class="text-end">{{r.products}}</td></tr>
          <tr *ngIf="!hsn.rows.length"><td colspan="7" class="text-muted">No tax invoices this month.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  `,
})
export class GstSummaryComponent implements OnInit {
  months: any[] | null = null;
  registered = false;
  month = "";
  sum: any = null;
  hsn: any = null;
  filedOn = "";
  arn = "";
  acceptHsn = false;
  reason = "";
  busy = false;
  error = "";
  message = "";

  constructor(private api: GstApiService) {}

  ngOnInit() { this.loadMonths(true); }

  get canClose() { return !!this.months?.find((m) => m.month === this.month)?.can_close; }

  private fail(e: any, fallback: string) { this.error = e?.error?.message || fallback; this.message = ''; this.busy = false; }

  loadMonths(first = false) {
    this.api.months().subscribe((r: any) => {
      this.months = r.months; this.registered = !!r.registered;
      if (first) { const prev = r.months.find((m: any) => m.over) || r.months[0]; this.open(prev.month); }
    }, (e) => this.fail(e, 'Could not load the months.'));
  }

  open(month: string) {
    this.month = month; this.sum = null; this.hsn = null; this.error = ''; this.acceptHsn = false; this.arn = ''; this.filedOn = ''; this.reason = '';
    this.api.monthlySummary(month).subscribe((s: any) => this.sum = s, (e) => this.fail(e, 'Could not load the summary.'));
    this.api.hsnSummary(month).subscribe((h: any) => this.hsn = h, () => {});
  }

  close() {
    this.error = this.message = ''; this.busy = true;
    this.api.closeMonth(this.month, { filed_on: this.filedOn || null, arn: this.arn, accept_hsn: this.acceptHsn }).subscribe((r: any) => {
      this.busy = false; this.months = r.months; this.registered = !!r.registered; this.message = `${this.sum.label} is closed.`; this.open(this.month);
    }, (e) => this.fail(e, 'Could not close the month.'));
  }

  reopen() {
    this.error = this.message = '';
    this.api.reopenMonth(this.month, this.reason).subscribe((r: any) => { this.months = r.months; this.registered = !!r.registered; this.message = `${this.sum.label} is open again.`; this.open(this.month); }, (e) => this.fail(e, 'Could not reopen the month.'));
  }
}
