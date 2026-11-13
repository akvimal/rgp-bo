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

    <p-dialog header="New customer order" [(visible)]="showNew" [modal]="true" [style]="{width:'50rem', maxWidth:'96vw'}" (onHide)="closeNew()">
      <div *ngIf="showNew" class="form-compact" data-testid="cm-new-dialog">
        <p class="small text-muted mb-3">For goods the store does not have yet. The store orders them for this customer, and any advance paid now is kept for this order until it is collected.</p>
        <div class="alert alert-danger py-2" *ngIf="newError" data-testid="cm-new-error">{{newError}}</div>
        <div class="row g-3">
          <div class="col-md-6" *ngIf="!stores.length || stores.length > 1">
            <label class="form-label">Store <span class="text-danger">*</span></label>
            <select class="form-select" [(ngModel)]="draft.storeid" data-testid="cm-new-store"><option [ngValue]="null">Choose a store</option><option *ngFor="let s of stores" [ngValue]="s.id">{{s.location}}</option></select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Customer <span class="text-danger">*</span></label>
            <div *ngIf="!draft.customer"><app-customer-select placeholder="Mobile or name" (customerSelected)="pickCustomer($event)"></app-customer-select>
              <div class="form-text">The customer must be on file: staff call them when the goods arrive.</div></div>
            <div *ngIf="draft.customer" class="form-control d-flex align-items-center justify-content-between" data-testid="cm-new-customer"><span><b>{{draft.customer.name}}</b> <span class="text-muted">{{draft.customer.mobile}}</span></span> <a role="button" class="small" (click)="draft.customer = null">Change</a></div>
          </div>
          <div class="col-md-6 col-lg-4">
            <label class="form-label">Needed by <span class="text-muted small">(optional)</span></label>
            <input type="date" class="form-control" [(ngModel)]="draft.neededby" data-testid="cm-new-needed">
          </div>

          <div class="col-12"><div class="fw-semibold">What the customer wants</div></div>
          <div class="col-12" *ngFor="let l of draft.lines; let i = index" [attr.data-testid]="'cm-line-' + i">
            <div class="border rounded p-2 p-md-3">
              <div class="row g-3 align-items-start">
                <div class="col-md-12 col-lg-6">
                  <label class="form-label">Product <span class="text-danger">*</span></label>
                  <div *ngIf="!l.title && !l.unlisted"><app-product-select (selected)="pickProduct(l, $event)"></app-product-select>
                    <a role="button" class="small d-inline-block mt-1" (click)="l.unlisted = true">Not in the product list? Type its name instead</a></div>
                  <div *ngIf="!l.title && l.unlisted"><input class="form-control" placeholder="Name, brand and strength" [(ngModel)]="l.requestedname" maxlength="200">
                    <a role="button" class="small d-inline-block mt-1" (click)="l.unlisted = false">Search the product list instead</a></div>
                  <div *ngIf="l.title" class="form-control d-flex align-items-center justify-content-between"><b>{{l.title}}</b> <a role="button" class="small" (click)="l.title = ''; l.productid = null">Change</a></div>
                </div>
                <div class="col-4 col-lg-2">
                  <label class="form-label">Packs <span class="text-danger">*</span></label>
                  <input type="number" min="1" class="form-control text-end" [(ngModel)]="l.qty" [attr.data-testid]="'cm-line-qty-' + i">
                </div>
                <div class="col-8 col-lg-3">
                  <label class="form-label">Price per pack <span class="text-muted small">(with GST)</span></label>
                  <div class="input-group"><span class="input-group-text">&#8377;</span><input type="number" min="0" step="0.01" class="form-control text-end" [(ngModel)]="l.agreedprice" [attr.data-testid]="'cm-line-price-' + i"></div>
                  <div class="form-text" *ngIf="+l.qty > 0 && +l.agreedprice > 0">Line total &#8377;{{(+l.qty * +l.agreedprice) | number:'1.2-2'}}</div>
                </div>
                <div class="col-12 col-lg-1 text-end" *ngIf="draft.lines.length > 1"><button type="button" class="btn btn-outline-danger btn-sm mt-lg-4" (click)="draft.lines.splice(i, 1)" title="Take this product off" aria-label="Remove product"><i class="bi bi-x-lg"></i></button></div>
              </div>
            </div>
          </div>
          <div class="col-12 d-flex flex-wrap justify-content-between align-items-center">
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="addLine()" data-testid="cm-add-line"><i class="bi bi-plus-lg me-1"></i>Add another product</button>
            <div class="fw-semibold" *ngIf="draftTotal > 0" data-testid="cm-new-total">Agreed total &#8377;{{draftTotal | number:'1.2-2'}}</div>
          </div>

          <div class="col-12"><div class="fw-semibold">Advance paid now <span class="text-muted small fw-normal">(optional)</span></div>
            <div class="form-text mt-0">Cash or UPI/card taken now is counted in the shift that is open, so it tallies with the drawer or the terminal.</div></div>
          <div class="col-6 col-md-4 col-lg-3">
            <label class="form-label">Amount</label>
            <div class="input-group"><span class="input-group-text">&#8377;</span><input type="number" min="0" step="0.01" class="form-control text-end" [(ngModel)]="draft.amount" data-testid="cm-new-amount"></div>
          </div>
          <div class="col-6 col-md-4 col-lg-3" *ngIf="+draft.amount > 0">
            <label class="form-label">Paid by <span class="text-danger">*</span></label>
            <select class="form-select" [(ngModel)]="draft.mode" data-testid="cm-new-mode"><option value="CASH">Cash</option><option value="DIGITAL">UPI / card</option></select>
          </div>
          <ng-container *ngIf="+draft.amount > 0 && draft.mode === 'DIGITAL'">
            <div class="col-6 col-md-4 col-lg-3"><label class="form-label">Method</label><select class="form-select" [(ngModel)]="draft.digimethod"><option>UPI</option><option>Card</option><option>Wallet</option><option>Other</option></select></div>
            <div class="col-6 col-md-4 col-lg-3"><label class="form-label">Reference <span class="text-muted small">(last 4)</span></label><input class="form-control" maxlength="40" [(ngModel)]="draft.digirefno" data-testid="cm-new-ref"></div>
          </ng-container>
          <div class="col-12" *ngIf="+draft.amount > 0 && draftTotal > 0" data-testid="cm-new-balance">
            <div class="small" [class.text-danger]="+draft.amount > draftTotal"><span *ngIf="+draft.amount <= draftTotal">Balance to pay when the customer collects: <b>&#8377;{{(draftTotal - +draft.amount) | number:'1.2-2'}}</b></span><span *ngIf="+draft.amount > draftTotal">The advance is more than the agreed total.</span></div>
          </div>

          <div class="col-12">
            <label class="form-label">Notes <span class="text-muted small">(optional)</span></label>
            <input class="form-control" maxlength="300" [(ngModel)]="draft.notes" placeholder="Anything staff should know, such as a preferred brand">
          </div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="btn btn-outline-secondary" (click)="closeNew()" [disabled]="saving">Cancel</button>
        <button type="button" class="btn btn-primary ms-2" (click)="save()" [disabled]="saving" data-testid="cm-new-save">{{saving ? 'Saving...' : 'Save the order'}}</button>
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
    for (let i = 0; i < d.lines.length; i++) {
      const l = d.lines[i], n = d.lines.length > 1 ? `Product ${i + 1}: ` : "";
      if (!l.productid && !String(l.requestedname || "").trim()) { this.newError = n + "choose the product, or type its name if it is not in the list."; return; }
      if (!Number.isInteger(+l.qty) || +l.qty < 1) { this.newError = n + "packs must be a whole number, at least 1."; return; }
    }
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
