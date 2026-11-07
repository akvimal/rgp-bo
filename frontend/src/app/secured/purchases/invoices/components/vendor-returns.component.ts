import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";
import { VendorsService } from "../../vendors/vendors.service";

/**
 * Goods sent back to a vendor. A return takes the goods out of stock and stays open until the vendor credits it on a later purchase invoice
 * (adjusted on that invoice's screen, where it comes off the invoice total).
 */
@Component({
  selector: "app-vendor-returns",
  template: `
    <div class="container-fluid py-3" data-testid="vendor-returns">
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
        <h5 class="mb-0 me-3">Returns to vendors</h5>
        <select class="form-select form-select-sm" style="width:auto" [(ngModel)]="status" (change)="load()" data-testid="vr-status">
          <option value="">All</option><option value="OPEN">Open (not yet credited)</option><option value="ADJUSTED">Credited on an invoice</option><option value="CANCELLED">Cancelled</option>
        </select>
        <select class="form-select form-select-sm" style="width:auto" [(ngModel)]="vendorFilter" (change)="load()" data-testid="vr-vendor-filter">
          <option value="">All vendors</option><option *ngFor="let v of vendors" [value]="v.id">{{v.name}}</option>
        </select>
        <button type="button" class="btn btn-primary btn-sm ms-auto" (click)="openNew()" data-testid="vr-new">New return</button>
      </div>
      <div class="alert alert-danger py-2" *ngIf="error" data-testid="vr-error">{{error}}</div>
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>#</th><th>Date</th><th>Vendor</th><th>From invoice</th><th>Lines</th><th class="text-end">Credit due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let r of rows" data-testid="vr-row">
              <td>{{r.returnno || r.id}}<div class="small text-muted" *ngIf="r.reason">{{r.reason}}</div></td>
              <td>{{r.returndate}}</td><td>{{r.vendor}}</td><td class="small" data-testid="vr-from">{{r.frominvoices || '-'}}</td><td>{{r.lines}}</td>
              <td class="text-end">{{r.total | number:'1.2-2'}}</td>
              <td><span class="badge" [ngClass]="r.status === 'OPEN' ? 'bg-warning text-dark' : (r.status === 'ADJUSTED' ? 'bg-success' : 'bg-secondary')">{{r.status === 'ADJUSTED' ? 'Credited' : (r.status === 'OPEN' ? 'Open' : 'Cancelled')}}</span>
                <span class="small text-muted ms-1" *ngIf="r.adjustedinvoiceno">on {{r.adjustedinvoiceno}}</span></td>
              <td class="text-end">
                <button type="button" class="btn btn-outline-secondary btn-sm py-0 me-1" (click)="show(r)" data-testid="vr-view">View</button>
                <button type="button" class="btn btn-outline-danger btn-sm py-0" *ngIf="r.status === 'OPEN'" (click)="cancelling = r; note = ''" data-testid="vr-cancel">Cancel</button>
              </td>
            </tr>
            <tr *ngIf="!rows.length"><td colspan="8" class="text-center text-muted py-3">No returns to vendors yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <p-dialog header="Return to vendor" [(visible)]="creating" [modal]="true" [style]="{width: '58rem', maxWidth: '96vw'}" [draggable]="false">
      <div class="alert alert-danger py-2" *ngIf="formError" data-testid="vr-form-error">{{formError}}</div>
      <div class="row g-2 mb-2">
        <div class="col-md-5"><label class="form-label">Vendor</label>
          <select class="form-select" [(ngModel)]="vendorid" (change)="lines = []; found = []" data-testid="vr-vendor">
            <option value="">Choose the vendor</option><option *ngFor="let v of vendors" [value]="v.id">{{v.name}}</option></select></div>
        <div class="col-md-3"><label class="form-label">Date</label><input type="date" class="form-control" [(ngModel)]="returndate"></div>
        <div class="col-md-4"><label class="form-label">Vendor's return / debit note no.</label><input class="form-control" maxlength="30" [(ngModel)]="returnno" data-testid="vr-no"></div>
        <div class="col-12"><label class="form-label">Why</label><input class="form-control" maxlength="200" [(ngModel)]="reason" placeholder="e.g. near expiry, damaged, wrong item" data-testid="vr-reason"></div>
      </div>
      <div class="input-group input-group-sm mb-2" *ngIf="vendorid">
        <input class="form-control" [(ngModel)]="search" (keyup.enter)="find()" placeholder="Find the batch to send back: product, batch or the invoice number it came in on" data-testid="vr-search">
        <button type="button" class="btn btn-outline-primary" (click)="find()" data-testid="vr-find">Find</button>
      </div>
      <div class="d-flex justify-content-between align-items-center small mb-1" *ngIf="found.length">
        <span class="text-muted">{{found.length}} batch{{found.length === 1 ? '' : 'es'}} in stock. Search by an invoice number to see what is left of it.</span>
        <button type="button" class="btn btn-outline-secondary btn-sm py-0" (click)="addAll()" data-testid="vr-add-all">Add all</button>
      </div>
      <div class="table-responsive mb-2" *ngIf="found.length" style="max-height:12rem;overflow:auto">
        <table class="table table-sm mb-0"><tbody>
          <tr *ngFor="let b of found" data-testid="vr-found">
            <td>{{b.title}}</td><td>{{b.batch}}</td><td>{{b.expdate}}</td><td class="small" data-testid="vr-found-inv">{{b.invoiceno || '-'}}<span class="text-muted" *ngIf="b.invoicedate"> &middot; {{b.invoicedate}}</span></td><td>in stock {{b.available}}</td>
            <td class="text-end"><button type="button" class="btn btn-outline-primary btn-sm py-0" (click)="addLine(b)" [disabled]="has(b)" data-testid="vr-add">Add</button></td>
          </tr></tbody></table>
      </div>
      <table class="table table-sm align-middle" *ngIf="lines.length" data-testid="vr-lines">
        <thead><tr><th>Item</th><th>Batch</th><th>Invoice</th><th style="width:6rem">Qty</th><th style="width:7rem">Credit rate</th><th>GST %</th><th class="text-end">Credit</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let l of lines; let i = index">
            <td>{{l.title}}<div class="small text-muted">in stock {{l.available}}</div></td><td>{{l.batch}}</td><td class="small">{{l.invoiceno || '-'}}</td>
            <td><input type="number" min="1" [max]="l.available" class="form-control form-control-sm" [(ngModel)]="l.qty" data-testid="vr-qty"></td>
            <td><input type="number" min="0" step="0.0001" class="form-control form-control-sm" [(ngModel)]="l.rate" data-testid="vr-rate"></td>
            <td>{{l.taxpcnt}}</td><td class="text-end">{{lineTotal(l) | number:'1.2-2'}}</td>
            <td><button type="button" class="btn btn-link text-danger btn-sm py-0" (click)="lines.splice(i, 1)">Remove</button></td>
          </tr>
        </tbody>
        <tfoot><tr class="fw-semibold"><td colspan="6" class="text-end">Credit due from the vendor</td><td class="text-end" data-testid="vr-total">{{total | number:'1.2-2'}}</td><td></td></tr></tfoot>
      </table>
      <div class="small text-muted">The goods leave stock now. The return stays open until the vendor credits it on a later invoice; adjust it there.</div>
      <ng-template pTemplate="footer">
        <button type="button" class="btn btn-outline-secondary" (click)="creating = false" [disabled]="busy">Cancel</button>
        <button type="button" class="btn btn-primary ms-2" (click)="save()" [disabled]="busy || !lines.length" data-testid="vr-save">Send back</button>
      </ng-template>
    </p-dialog>

    <p-dialog [header]="'Return ' + (viewing?.returnno || viewing?.id || '')" [visible]="!!viewing" (visibleChange)="!$event && (viewing = null)" [modal]="true" [style]="{width: '40rem'}" [draggable]="false">
      <div *ngIf="viewing" data-testid="vr-detail">
        <div class="small text-muted mb-2">{{viewing.vendor}} &middot; {{viewing.returndate}} <span *ngIf="viewing.reason">&middot; {{viewing.reason}}</span> <span *ngIf="viewing.cancelnote">&middot; cancelled: {{viewing.cancelnote}}</span></div>
        <table class="table table-sm"><thead><tr><th>Item</th><th>Batch</th><th>From invoice</th><th>Qty</th><th>Rate</th><th class="text-end">Credit</th></tr></thead>
          <tbody><tr *ngFor="let i of viewing.items"><td>{{i.title}}</td><td>{{i.batch}}</td><td class="small" data-testid="vr-detail-inv">{{i.invoiceno || '-'}}<span class="text-muted" *ngIf="i.invoicedate"> &middot; {{i.invoicedate}}</span></td><td>{{i.qty}}</td><td>{{i.rate}}</td><td class="text-end">{{i.total * (1 + i.taxpcnt / 100) | number:'1.2-2'}}</td></tr></tbody>
          <tfoot><tr class="fw-semibold"><td colspan="5" class="text-end">Credit due</td><td class="text-end">{{viewing.total | number:'1.2-2'}}</td></tr></tfoot></table>
      </div>
    </p-dialog>

    <p-dialog header="Cancel this return" [visible]="!!cancelling" (visibleChange)="!$event && (cancelling = null)" [modal]="true" [style]="{width: '30rem'}" [draggable]="false">
      <div *ngIf="cancelling">
        <p class="small">The goods come back into stock. Return {{cancelling.returnno || cancelling.id}} to {{cancelling.vendor}}.</p>
        <input class="form-control" maxlength="200" [(ngModel)]="note" placeholder="Why is it cancelled? (required)" data-testid="vr-cancel-note">
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="btn btn-outline-secondary" (click)="cancelling = null">Keep it</button>
        <button type="button" class="btn btn-danger ms-2" (click)="confirmCancel()" data-testid="vr-cancel-go">Cancel the return</button>
      </ng-template>
    </p-dialog>`
})
export class VendorReturnsComponent implements OnInit {
  rows: any[] = [];
  vendors: any[] = [];
  status = "";
  vendorFilter = "";
  error = "";

  creating = false;
  vendorid: any = "";
  returndate = "";
  returnno = "";
  reason = "";
  search = "";
  found: any[] = [];
  lines: any[] = [];
  formError = "";
  busy = false;
  viewing: any = null;
  cancelling: any = null;
  note = "";
  private storeid: any = null;

  constructor(private http: HttpClient, private vendorsService: VendorsService, private storeContext: StoreContextService) {}

  ngOnInit() {
    this.vendorsService.options().subscribe((v: any) => this.vendors = v, () => {});
    this.storeContext.stores$.subscribe((s: any) => this.storeid = this.storeContext.selectedStoreId || (s && s[0] && s[0].id) || null);
    this.load();
  }

  private msg(e: any, fallback: string): string { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || fallback); }

  load() {
    const q = [this.status ? `status=${this.status}` : "", this.vendorFilter ? `vendor=${this.vendorFilter}` : ""].filter(Boolean).join("&");
    this.http.get<any[]>(`${environment.apiHost}/vendor-returns${q ? "?" + q : ""}`).subscribe(r => { this.rows = r || []; this.error = ""; }, e => this.error = this.msg(e, "Could not load the returns."));
  }

  show(r: any) { this.http.get<any>(`${environment.apiHost}/vendor-returns/${r.id}`).subscribe(d => this.viewing = d, e => this.error = this.msg(e, "Could not open the return.")); }

  openNew() {
    this.creating = true; this.vendorid = ""; this.returnno = ""; this.reason = ""; this.search = ""; this.found = []; this.lines = []; this.formError = "";
    this.returndate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  }

  find() {
    this.formError = "";
    this.http.get<any[]>(`${environment.apiHost}/vendor-returns/returnable?vendor=${this.vendorid}&store=${this.storeid}&q=${encodeURIComponent(this.search || "")}`)
      .subscribe(r => this.found = r || [], e => this.formError = this.msg(e, "Could not look up the stock."));
  }

  has(b: any): boolean { return this.lines.some(l => l.itemid === b.itemid); }
  addLine(b: any) { if (!this.has(b)) this.lines.push({ ...b, qty: 1 }); }
  addAll() { this.found.forEach(b => this.addLine(b)); }
  lineTotal(l: any): number { const t = (+l.qty || 0) * (+l.rate || 0); return Math.round(t * (1 + (+l.taxpcnt || 0) / 100) * 100) / 100; }
  get total(): number { return Math.round(this.lines.reduce((s, l) => s + this.lineTotal(l), 0) * 100) / 100; }

  save() {
    this.formError = ""; this.busy = true;
    const body = { vendorid: +this.vendorid, storeid: +this.storeid, returndate: this.returndate, returnno: this.returnno, reason: this.reason,
      items: this.lines.map(l => ({ itemid: l.itemid, qty: +l.qty, rate: +l.rate })) };
    this.http.post(`${environment.apiHost}/vendor-returns`, body).subscribe(() => { this.busy = false; this.creating = false; this.load(); },
      e => { this.busy = false; this.formError = this.msg(e, "Could not save the return."); });
  }

  confirmCancel() {
    this.http.post(`${environment.apiHost}/vendor-returns/${this.cancelling.id}/cancel`, { note: this.note }).subscribe(() => { this.cancelling = null; this.load(); },
      e => { this.error = this.msg(e, "Could not cancel the return."); this.cancelling = null; });
  }
}
