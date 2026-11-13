import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { StoreContextService } from "src/app/@core/store-context.service";
import { CommitmentsService, STATUS_CLASS, STATUS_LABEL, errorText } from "./commitments.service";

/** The store's customer orders: taken at the counter, paid in advance, bought through purchasing, collected on a later bill. */
@Component({
  selector: "app-commitments",
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <h5 class="mb-0">Customer orders</h5>
      <span class="text-muted small">Ordered for a customer and paid in advance, for goods the store does not have yet.</span>
      <button type="button" class="btn btn-primary btn-sm ms-auto" (click)="openNew()" data-testid="cm-new"><i class="bi bi-plus-lg"></i> New order</button>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-2">
      <select class="form-select form-select-sm w-auto" [(ngModel)]="status" (change)="load()" aria-label="Show" data-testid="cm-status">
        <option value="ACTIVE">Open orders</option><option value="READY">Arrived, to collect</option><option value="ORDERED">On order</option><option value="OPEN">Not ordered yet</option>
        <option value="COLLECTED">Collected</option><option value="CANCELLED">Cancelled</option><option value="ALL">All</option>
      </select>
      <input class="form-control form-control-sm w-auto" placeholder="Customer name or mobile" [(ngModel)]="q" (keyup.enter)="load()" data-testid="cm-search">
      <button type="button" class="btn btn-outline-secondary btn-sm" (click)="load()">Search</button>
      <span class="ms-auto small text-muted align-self-center" *ngIf="rows.length" data-testid="cm-held-total">Advance held on these &#8377;{{heldTotal | number:'1.0-0'}}</span>
    </div>

    <div class="alert alert-danger py-2" *ngIf="error">{{error}}</div>
    <div class="hist-card" *ngIf="rows.length; else none">
      <table class="table table-sm table-hover align-middle mb-0" data-testid="cm-table">
        <thead><tr><th>Customer</th><th>Ordered</th><th>Needed by</th><th>Status</th><th class="text-end">Total</th><th class="text-end">Paid in advance</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows" data-testid="cm-row" [attr.data-status]="r.status">
            <td>{{r.customer}}<div class="small text-muted">{{r.mobile}} &middot; {{r.store}}</div></td>
            <td class="small">{{r.items}}<div class="text-muted" *ngIf="r.lines_in">{{r.lines_in}} of {{r.lines}} line{{r.lines === 1 ? '' : 's'}} arrived</div></td>
            <td class="small" [class.text-danger]="r.needed_by && r.needed_by < today && (r.status === 'OPEN' || r.status === 'ORDERED')">{{r.needed_by ? (r.needed_by | date:'dd MMM') : ''}}</td>
            <td><span class="badge" [ngClass]="cls(r.status)">{{label(r.status)}}</span>
              <div class="small text-muted" *ngIf="r.status === 'READY'">{{r.notified_at ? 'customer told' : 'tell the customer'}}<span *ngIf="r.hold_until"> &middot; held to {{r.hold_until | date:'dd MMM'}}</span></div></td>
            <td class="text-end">{{r.total ? (r.total | number:'1.2-2') : ''}}</td>
            <td class="text-end">&#8377;{{r.held | number:'1.2-2'}}</td>
            <td class="text-end"><a [routerLink]="[r.id]" class="btn btn-sm btn-outline-primary" data-testid="cm-open">Open</a></td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #none><div class="hist-empty" data-testid="cm-none"><i class="bi bi-bag-heart"></i>No orders here.</div></ng-template>

    <p-dialog header="New customer order" [(visible)]="showNew" [modal]="true" [style]="{width:'46rem', maxWidth:'96vw'}" (onHide)="closeNew()">
      <div *ngIf="showNew" data-testid="cm-new-dialog">
        <div class="row g-2">
          <div class="col-12" *ngIf="!stores.length || stores.length > 1">
            <label class="form-label small mb-0">Store</label>
            <select class="form-select form-select-sm" [(ngModel)]="draft.storeid" data-testid="cm-new-store"><option [ngValue]="null">Choose</option><option *ngFor="let s of stores" [ngValue]="s.id">{{s.location}}</option></select>
          </div>
          <div class="col-md-8">
            <label class="form-label small mb-0">Customer</label>
            <div *ngIf="!draft.customer"><app-customer-select placeholder="Mobile or name" (customerSelected)="pickCustomer($event)"></app-customer-select></div>
            <div *ngIf="draft.customer" class="small"><b>{{draft.customer.name}}</b> {{draft.customer.mobile}} <a role="button" (click)="draft.customer = null">change</a></div>
          </div>
          <div class="col-md-4"><label class="form-label small mb-0">Needed by</label><input type="date" class="form-control form-control-sm" [(ngModel)]="draft.neededby" data-testid="cm-new-needed"></div>
        </div>

        <h6 class="mt-3 mb-1">What the customer wants</h6>
        <div class="border rounded p-2 mb-1" *ngFor="let l of draft.lines; let i = index" [attr.data-testid]="'cm-line-' + i">
          <div class="row g-2 align-items-end">
            <div class="col-md-6">
              <label class="form-label small mb-0">Product</label>
              <div *ngIf="!l.title"><app-product-select (selected)="pickProduct(l, $event)"></app-product-select>
                <a role="button" class="small" (click)="l.unlisted = !l.unlisted">{{l.unlisted ? 'search the list' : 'not in the list? type its name'}}</a>
                <input *ngIf="l.unlisted" class="form-control form-control-sm mt-1" placeholder="Name of the product" [(ngModel)]="l.requestedname" maxlength="200"></div>
              <div *ngIf="l.title" class="small"><b>{{l.title}}</b> <a role="button" (click)="l.title = ''; l.productid = null">change</a></div>
            </div>
            <div class="col-4 col-md-2"><label class="form-label small mb-0">Packs</label><input type="number" min="1" class="form-control form-control-sm text-end" [(ngModel)]="l.qty" [attr.data-testid]="'cm-line-qty-' + i"></div>
            <div class="col-5 col-md-3"><label class="form-label small mb-0">Price per pack</label><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end" [(ngModel)]="l.agreedprice" placeholder="with GST" [attr.data-testid]="'cm-line-price-' + i"></div>
            <div class="col-3 col-md-1 text-end"><button type="button" class="btn btn-sm btn-outline-danger" *ngIf="draft.lines.length > 1" (click)="draft.lines.splice(i, 1)" aria-label="Remove line"><i class="bi bi-x-lg"></i></button></div>
          </div>
        </div>
        <button type="button" class="btn btn-link btn-sm px-0" (click)="addLine()" data-testid="cm-add-line">+ Add another product</button>
        <div class="small text-muted" *ngIf="draftTotal > 0">Agreed total &#8377;{{draftTotal | number:'1.2-2'}}</div>

        <h6 class="mt-3 mb-1">Advance <span class="text-muted small fw-normal">(optional: counted in the shift that is open now)</span></h6>
        <div class="row g-2">
          <div class="col-4 col-md-3"><label class="form-label small mb-0">Amount</label><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end" [(ngModel)]="draft.amount" data-testid="cm-new-amount"></div>
          <div class="col-8 col-md-4" *ngIf="+draft.amount > 0"><label class="form-label small mb-0">Paid by</label>
            <select class="form-select form-select-sm" [(ngModel)]="draft.mode" data-testid="cm-new-mode"><option value="CASH">Cash</option><option value="DIGITAL">UPI / card</option></select></div>
          <ng-container *ngIf="+draft.amount > 0 && draft.mode === 'DIGITAL'">
            <div class="col-6 col-md-2"><label class="form-label small mb-0">How</label><select class="form-select form-select-sm" [(ngModel)]="draft.digimethod"><option>UPI</option><option>Card</option><option>Wallet</option><option>Other</option></select></div>
            <div class="col-6 col-md-3"><label class="form-label small mb-0">Ref (last 4)</label><input class="form-control form-control-sm" maxlength="40" [(ngModel)]="draft.digirefno" data-testid="cm-new-ref"></div>
          </ng-container>
        </div>
        <div class="mt-2"><label class="form-label small mb-0">Notes</label><input class="form-control form-control-sm" maxlength="300" [(ngModel)]="draft.notes"></div>
        <div class="alert alert-danger py-2 small mt-2 mb-0" *ngIf="newError" data-testid="cm-new-error">{{newError}}</div>
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="btn btn-outline-secondary" (click)="closeNew()" [disabled]="saving">Cancel</button>
        <button type="button" class="btn btn-primary ms-2" (click)="save()" [disabled]="saving" data-testid="cm-new-save">Save the order</button>
      </ng-template>
    </p-dialog>`
})
export class CommitmentsComponent implements OnInit {
  rows: any[] = [];
  status = "ACTIVE";
  q = "";
  error = "";
  today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

  showNew = false;
  saving = false;
  newError = "";
  draft: any = {};

  constructor(private service: CommitmentsService, private storeContext: StoreContextService, private router: Router) {}

  get stores(): any[] { return this.storeContext.stores || []; }
  get heldTotal(): number { return this.rows.reduce((s, r) => s + (+r.held || 0), 0); }
  get draftTotal(): number { return (this.draft.lines || []).reduce((s: number, l: any) => s + (+l.qty || 0) * (+l.agreedprice || 0), 0); }
  label(s: string) { return STATUS_LABEL[s] || s; }
  cls(s: string) { return STATUS_CLASS[s] || "bg-secondary"; }

  ngOnInit() { this.load(); }

  load() {
    this.error = "";
    this.service.list({ status: this.status, storeid: this.storeContext.selectedStoreId, q: this.q.trim() }).subscribe(
      r => this.rows = r || [], e => this.error = errorText(e, "Could not load the orders."));
  }

  openNew() {
    this.draft = { storeid: this.storeContext.selectedStoreId || (this.stores.length === 1 ? this.stores[0].id : null), customer: null, neededby: "", notes: "", lines: [this.blankLine()], amount: null, mode: "CASH", digimethod: "UPI", digirefno: "" };
    this.newError = ""; this.saving = false; this.showNew = true;
  }
  closeNew() { this.showNew = false; }
  private blankLine() { return { productid: null, title: "", requestedname: "", unlisted: false, qty: 1, agreedprice: null }; }
  addLine() { this.draft.lines.push(this.blankLine()); }
  pickCustomer(c: any) { this.draft.customer = c && c.id ? c : null; if (c && !c.id) this.newError = "Choose an existing customer, or add the customer first under Customers."; }
  pickProduct(l: any, p: any) { l.productid = p?.id || null; l.title = p?.title || ""; l.unlisted = false; }

  save() {
    const d = this.draft;
    this.newError = "";
    if (!d.storeid) { this.newError = "Choose the store."; return; }
    if (!d.customer?.id) { this.newError = "Choose the customer: an order needs a named customer to call."; return; }
    const body: any = {
      storeid: d.storeid, customerid: d.customer.id, neededby: d.neededby || null, notes: d.notes || null,
      lines: d.lines.map((l: any) => ({ productid: l.productid, requestedname: l.productid ? null : l.requestedname, qty: +l.qty, agreedprice: l.agreedprice === null || l.agreedprice === "" ? null : +l.agreedprice }))
    };
    if (+d.amount > 0) body.advance = { amount: +d.amount, mode: d.mode, digimethod: d.mode === "DIGITAL" ? d.digimethod : null, digirefno: d.mode === "DIGITAL" ? d.digirefno : null };
    this.saving = true;
    this.service.create(body).subscribe(
      (c: any) => { this.saving = false; this.showNew = false; this.router.navigate(["/secure/commitments", c.id]); },
      e => { this.saving = false; this.newError = errorText(e, "The order could not be saved."); });
  }
}
