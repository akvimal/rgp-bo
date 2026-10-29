import { Component, OnInit } from "@angular/core";
import { GstApiService } from "./gst-api.service";

/**
 * GST rate changes: a change of the GST billed, from a date, for all products, a category, an HSN prefix or one product. Preview first (what it does to
 * stock and prices), then save. A bill dated on or after the date is billed at the new rate; bills already made never change.
 */
@Component({
  selector: "app-gst-rates",
  template: `
  <p class="small text-muted" data-testid="gstr-intro">
    When the government changes a GST rate, add it here with the date it starts. From that date the till bills the new rate on stock you bought earlier too,
    and bills already made stay as they were. The purchase invoices keep the rate the vendor charged, so your input credit is unchanged.
  </p>
  <div class="alert alert-danger py-2" *ngIf="error" data-testid="gstr-error">{{error}}</div>
  <div class="alert alert-success py-2" *ngIf="message" data-testid="gstr-message">{{message}}</div>

  <h6 class="text-primary">Changes</h6>
  <table class="table table-sm" data-testid="gstr-list">
    <thead><tr><th>Covers</th><th>GST</th><th>From</th><th>Prices</th><th>State</th><th>Note</th><th></th></tr></thead>
    <tbody>
      <tr *ngIf="!changes.length"><td colspan="7" class="text-muted">No changes yet. Until you add one the till bills each batch's own GST.</td></tr>
      <tr *ngFor="let c of changes" [class.text-muted]="c.state === 'cancelled'" data-testid="gstr-row">
        <td>{{coverText(c)}}</td>
        <td>{{c.mode === 'cap' ? 'at most ' : ''}}{{c.rate}}%</td>
        <td>{{c.effective_from | date:'dd MMM yyyy'}}</td>
        <td>{{c.price_policy === 'keep_price' ? 'Keep the price' : 'Pass the saving on'}}</td>
        <td><span class="badge" [ngClass]="c.state === 'in force' ? 'bg-success' : c.state === 'upcoming' ? 'bg-warning text-dark' : 'bg-secondary'">{{c.state}}</span></td>
        <td class="small">{{c.note}}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-secondary me-1" type="button" (click)="openReport(c)" *ngIf="c.state !== 'cancelled'" data-testid="gstr-report">Report</button>
          <button class="btn btn-sm btn-outline-danger" type="button" (click)="withdraw(c)" *ngIf="c.state === 'upcoming'" data-testid="gstr-withdraw">Withdraw</button>
        </td>
      </tr>
    </tbody>
  </table>

  <h6 class="text-primary mt-4">New change</h6>
  <div class="row g-2 align-items-end" data-testid="gstr-form">
    <div class="col-md-3">
      <label class="form-label">Covers</label>
      <select class="form-select" [(ngModel)]="form.scope_type" (ngModelChange)="scopeChanged()" data-testid="gstr-scope">
        <option value="all">All products</option>
        <option value="category">A category</option>
        <option value="hsn_prefix">An HSN prefix</option>
        <option value="product">One product</option>
      </select>
    </div>
    <div class="col-md-3" *ngIf="form.scope_type === 'category'">
      <label class="form-label">Category</label>
      <input class="form-control" list="gstr-cats" [(ngModel)]="form.scope_value" data-testid="gstr-value">
      <datalist id="gstr-cats"><option *ngFor="let c of categories" [value]="c"></option></datalist>
    </div>
    <div class="col-md-3" *ngIf="form.scope_type === 'hsn_prefix'">
      <label class="form-label">HSN starts with</label>
      <input class="form-control" maxlength="8" placeholder="e.g. 3004" [(ngModel)]="form.scope_value" data-testid="gstr-value">
    </div>
    <div class="col-md-3" *ngIf="form.scope_type === 'product'">
      <label class="form-label">Product</label>
      <app-product-select (selected)="pickProduct($event)"></app-product-select>
      <div class="small text-muted" *ngIf="form.productTitle">{{form.productTitle}}</div>
    </div>
    <div class="col-md-2">
      <label class="form-label">The GST is</label>
      <select class="form-select" [(ngModel)]="form.mode" data-testid="gstr-mode">
        <option value="set">Set to</option>
        <option value="cap">At most</option>
      </select>
    </div>
    <div class="col-md-1">
      <label class="form-label">Rate %</label>
      <input type="number" min="0" max="40" step="0.5" class="form-control" [(ngModel)]="form.rate" data-testid="gstr-rate">
    </div>
    <div class="col-md-2">
      <label class="form-label">Starts on</label>
      <input type="date" class="form-control" [(ngModel)]="form.effective_from" data-testid="gstr-date">
    </div>
    <div class="col-12 col-md-6">
      <label class="form-label">Note (the notification)</label>
      <input class="form-control" maxlength="300" [(ngModel)]="form.note" data-testid="gstr-note">
    </div>
    <div class="col-12 col-md-6">
      <label class="form-label d-block">Price of stock you already have</label>
      <div class="form-check form-check-inline"><input class="form-check-input" type="radio" id="gstr-p1" name="gstr-pol" value="pass_saving" [(ngModel)]="form.price_policy" data-testid="gstr-pass">
        <label class="form-check-label" for="gstr-p1">Pass the saving on (recommended)</label></div>
      <div class="form-check form-check-inline"><input class="form-check-input" type="radio" id="gstr-p2" name="gstr-pol" value="keep_price" [(ngModel)]="form.price_policy" data-testid="gstr-keep">
        <label class="form-check-label" for="gstr-p2">Keep the price</label></div>
    </div>
    <div class="col-12" *ngIf="form.price_policy === 'keep_price'">
      <div class="alert alert-warning py-2 mb-0" data-testid="gstr-keep-warn">
        Keeping the price means the customer pays the same while the tax is less, so the shop keeps the difference. If the tax authority checks that a tax cut reached customers, this is the choice they may question.
        <div class="form-check mt-1"><input class="form-check-input" type="checkbox" id="gstr-conf" [(ngModel)]="form.confirm" data-testid="gstr-confirm"><label class="form-check-label" for="gstr-conf">I decide to keep the price</label></div>
      </div>
    </div>
    <div class="col-12">
      <button class="btn btn-outline-primary me-2" type="button" [disabled]="busy" (click)="doPreview()" data-testid="gstr-preview">Preview</button>
      <button class="btn btn-primary" type="button" [disabled]="busy || !preview" (click)="save()" data-testid="gstr-save">Save the change</button>
    </div>
  </div>

  <div class="mt-3" *ngIf="preview" data-testid="gstr-preview-box">
    <h6 class="text-primary">What this does</h6>
    <p class="mb-1">{{preview.change.label}} from {{preview.change.effective_from | date:'dd MMM yyyy'}}:
      <strong>{{preview.affected}}</strong> product(s) change rate, <strong>{{preview.with_stock}}</strong> of them with stock.
      <span *ngIf="preview.overridden"> {{preview.overridden}} are decided by a more specific change already set.</span></p>
    <div class="alert alert-warning py-2 small" *ngIf="preview.not_covered" data-testid="gstr-notcovered">
      <strong>{{preview.not_covered}}</strong> product(s) are not covered because their HSN is not known (for example {{notCoveredNames()}}).
      Add the HSN under the HSN tab, or cover them by category or product instead.
    </div>
    <div class="small text-muted mb-1">Prices are per pack; the list price is without GST and the bill adds the GST billed. Passing the saving on changes no price: the customer simply pays less tax.</div>
    <div class="table-responsive" style="max-height:22rem">
      <table class="table table-sm table-striped" data-testid="gstr-preview-table">
        <thead><tr><th>Product</th><th>HSN</th><th class="text-end">Stock</th><th class="text-end">Rate</th><th class="text-end">MRP</th><th class="text-end">Price now</th>
          <th class="text-end">Customer pays now</th><th class="text-end">Pass the saving on</th><th class="text-end">Keep the price: new price</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of preview.rows">
            <td>{{r.title}}<div class="small text-muted">{{r.category}}</div></td>
            <td>{{r.hsn || '-'}}<span class="badge bg-light text-dark ms-1" *ngIf="r.hsn_source === 'category'">provisional</span></td>
            <td class="text-end">{{r.stock | number:'1.0-0'}}</td>
            <td class="text-end">{{r.old_rate}}% &rarr; {{r.new_rate}}%</td>
            <td class="text-end">{{r.mrp | number:'1.2-2'}}</td>
            <td class="text-end">{{r.price !== null ? (r.price | number:'1.2-2') : '-'}}</td>
            <td class="text-end">{{r.customer_now !== null ? (r.customer_now | number:'1.2-2') : '-'}}</td>
            <td class="text-end">{{r.pass_customer !== null ? (r.pass_customer | number:'1.2-2') : '-'}}</td>
            <td class="text-end">{{r.keep_price !== null ? (r.keep_price | number:'1.2-2') : '-'}} <span class="small text-muted" *ngIf="r.keep_customer !== null">(customer {{r.keep_customer | number:'1.2-2'}})</span></td>
          </tr>
          <tr *ngIf="!preview.rows.length"><td colspan="9" class="text-muted">No product changes rate with this change.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="small text-muted" *ngIf="preview.truncated">The first 300 products are shown.</div>
  </div>

  <div class="modal-backdrop-lite" *ngIf="report" data-testid="gstr-report-box">
    <div class="card shadow p-3" style="max-width:60rem;margin:2rem auto;max-height:80vh;overflow:auto">
      <div class="d-flex justify-content-between"><h6 class="text-primary">{{report.change.label}} from {{report.change.effective_from | date:'dd MMM yyyy'}}</h6>
        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="report = null">Close</button></div>
      <p class="small mb-1">{{report.products}} product(s) are billed under this change.</p>
      <table class="table table-sm w-auto" *ngIf="report.sales_by_rate.length">
        <thead><tr><th>Sold since, billed at</th><th class="text-end">Quantity</th><th class="text-end">Value</th></tr></thead>
        <tbody><tr *ngFor="let s of report.sales_by_rate"><td>{{s.rate}}%</td><td class="text-end">{{s.qty | number:'1.0-0'}}</td><td class="text-end">{{s.value | number:'1.2-2'}}</td></tr></tbody>
      </table>
      <table class="table table-sm table-striped">
        <thead><tr><th>Product</th><th class="text-end">Batch GST</th><th class="text-end">Billed at</th><th class="text-end">Stock</th><th>Sold since</th></tr></thead>
        <tbody><tr *ngFor="let r of report.rows"><td>{{r.title}}</td><td class="text-end">{{r.batch_tax}}%</td><td class="text-end">{{r.billed_rate}}%</td><td class="text-end">{{r.stock | number:'1.0-0'}}</td>
          <td class="small"><span *ngFor="let s of r.sold">{{s.qty}} at {{s.rate}}%; </span></td></tr></tbody>
      </table>
    </div>
  </div>
  `,
  styles: [`.modal-backdrop-lite{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:1050;overflow:auto;padding:0 1rem}`],
})
export class GstRatesComponent implements OnInit {
  changes: any[] = [];
  categories: string[] = [];
  form: any = this.blank();
  preview: any = null;
  report: any = null;
  busy = false;
  error = "";
  message = "";

  constructor(private api: GstApiService) {}

  ngOnInit() { this.load(); this.api.missingHsn().subscribe((d: any) => this.categories = (d.categories || []).map((c: any) => c.category).filter((c: string) => c !== '(no category)'), () => {}); }

  private blank() { return { scope_type: 'all', scope_value: '', productTitle: '', mode: 'set', rate: 5, effective_from: '', price_policy: 'pass_saving', note: '', confirm: false }; }

  load() { this.api.rateChanges().subscribe((r: any) => this.changes = r.changes, (e) => this.fail(e, 'Could not load the changes.')); }

  private fail(e: any, fallback: string) { this.error = e?.error?.message || fallback; this.message = ''; this.busy = false; }

  coverText(c: any) { return c.scope_type === 'all' ? 'All products' : c.scope_type === 'category' ? `Category: ${c.scope_value}` : c.scope_type === 'hsn_prefix' ? `HSN ${c.scope_value}...` : `Product #${c.scope_value}`; }

  scopeChanged() { this.form.scope_value = ''; this.form.productTitle = ''; this.preview = null; }

  pickProduct(p: any) { this.form.scope_value = String(p.id); this.form.productTitle = p.title; this.preview = null; }

  private body() { const f = this.form; return { scope_type: f.scope_type, scope_value: f.scope_value, mode: f.mode, rate: f.rate, effective_from: f.effective_from, note: f.note, price_policy: f.price_policy, confirm_keep_price: !!f.confirm }; }

  doPreview() {
    this.error = this.message = ''; this.busy = true; this.preview = null;
    this.api.previewChange(this.body()).subscribe((p: any) => { this.preview = p; this.busy = false; }, (e) => this.fail(e, 'Could not preview the change.'));
  }

  notCoveredNames() { return (this.preview?.not_covered_sample || []).slice(0, 3).map((p: any) => p.title).join(', '); }

  save() {
    this.error = this.message = ''; this.busy = true;
    this.api.createChange(this.body()).subscribe(() => {
      this.busy = false; this.preview = null; this.form = this.blank(); this.message = 'The change is saved. Bills dated on or after its date are billed at the new rate.'; this.load();
    }, (e) => this.fail(e, 'Could not save the change.'));
  }

  withdraw(c: any) {
    this.error = this.message = '';
    this.api.cancelChange(c.id).subscribe(() => { this.message = 'The change is withdrawn.'; this.load(); }, (e) => this.fail(e, 'Could not withdraw the change.'));
  }

  openReport(c: any) { this.api.changeReport(c.id).subscribe((r: any) => this.report = r, (e) => this.fail(e, 'Could not load the report.')); }
}
