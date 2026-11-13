import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { CommitmentsService, STATUS_CLASS, STATUS_LABEL, errorText } from "./commitments.service";

/** One customer order: what was asked for, the advance held, where it is in purchasing, and what the store does next. */
@Component({
  selector: "app-commitment-view",
  template: `
    <div class="d-flex align-items-center gap-2 mb-2">
      <a routerLink=".." class="small">&larr; Customer orders</a>
    </div>
    <div class="alert alert-danger py-2" *ngIf="error" data-testid="cmv-error">{{error}}</div>
    <div *ngIf="c" data-testid="cmv">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
        <h5 class="mb-0">Order #{{c.id}} &middot; {{c.customer}}</h5>
        <span class="badge" [ngClass]="cls(c.status)" data-testid="cmv-status">{{label(c.status)}}</span>
        <span class="small text-muted">{{c.mobile}} &middot; {{c.store}}</span>
      </div>
      <div class="small text-muted mb-2">
        Taken {{c.createdon | date:'dd MMM yyyy'}}<span *ngIf="c.createdby"> by {{c.createdby}}</span>
        <span *ngIf="c.neededby"> &middot; needed by {{c.neededby | date:'dd MMM'}}</span>
        <span *ngIf="c.holduntil && c.status === 'READY'"> &middot; goods held until {{c.holduntil | date:'dd MMM'}}</span>
        <span *ngIf="c.notifiedat"> &middot; customer told {{c.notifiedat | date:'dd MMM HH:mm'}}<span *ngIf="c.notifiedby"> by {{c.notifiedby}}</span></span>
        <span *ngIf="c.notes"> &middot; {{c.notes}}</span>
      </div>

      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Agreed total</div><div class="fs-5" data-testid="cmv-total">&#8377;{{c.total | number:'1.2-2'}}</div></div></div>
        <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Paid in advance, held</div><div class="fs-5" data-testid="cmv-held">&#8377;{{c.held | number:'1.2-2'}}</div></div></div>
        <div class="col-6 col-md-3" *ngIf="c.total > 0"><div class="border rounded p-2"><div class="small text-muted">To pay at collection</div><div class="fs-5" data-testid="cmv-due">&#8377;{{(c.total - c.held > 0 ? c.total - c.held : 0) | number:'1.2-2'}}</div></div></div>
        <div class="col-6 col-md-3" *ngIf="c.saleid"><div class="border rounded p-2"><div class="small text-muted">Collected on bill</div><a [routerLink]="['/secure/sales/view', c.saleid]">#{{c.saleid}}</a></div></div>
      </div>

      <div class="d-flex flex-wrap gap-2 mb-3" *ngIf="open">
        <button type="button" class="btn btn-sm btn-primary" (click)="begin('pay')" data-testid="cmv-pay">Take advance</button>
        <button type="button" class="btn btn-sm btn-outline-primary" *ngIf="unrequested" (click)="raise()" [disabled]="busy" data-testid="cmv-raise">Order it: raise purchase request{{unrequested === 1 ? '' : 's'}}</button>
        <button type="button" class="btn btn-sm btn-success" *ngIf="c.status === 'READY' && !c.notifiedat" (click)="begin('notify')" data-testid="cmv-notify">Customer told</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" *ngIf="c.canmanage && c.held > 0" (click)="begin('refund')" data-testid="cmv-refund">Pay back advance</button>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="begin('cancel')" data-testid="cmv-cancel">Cancel order</button>
      </div>
      <div class="small text-muted mb-3" *ngIf="c.status === 'READY'">The goods are here. Bill them at the till: choose this customer and tick "collect it" under the payment, and the advance comes off the bill.</div>

      <div class="border rounded p-3 mb-3" *ngIf="action" data-testid="cmv-form">
        <h6 class="mb-2">{{actionTitle}}</h6>
        <div class="row g-2">
          <ng-container *ngIf="action === 'pay' || action === 'refund'">
            <div class="col-6 col-md-3"><label class="form-label small mb-0">Amount</label><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end" [(ngModel)]="f.amount" data-testid="cmv-amount"></div>
          </ng-container>
          <ng-container *ngIf="action === 'pay' || action === 'refund' || (action === 'cancel' && c.held > 0)">
            <div class="col-6 col-md-3"><label class="form-label small mb-0">{{action === 'pay' ? 'Paid by' : 'Paid back by'}}</label>
              <select class="form-select form-select-sm" [(ngModel)]="f.mode" data-testid="cmv-mode"><option value="CASH">Cash</option><option value="DIGITAL">UPI / card</option><option value="WALLET" *ngIf="action !== 'pay'">To the customer's wallet</option></select></div>
            <ng-container *ngIf="f.mode === 'DIGITAL'">
              <div class="col-6 col-md-2"><label class="form-label small mb-0">How</label><select class="form-select form-select-sm" [(ngModel)]="f.digimethod"><option>UPI</option><option>Card</option><option>Wallet</option><option>Other</option></select></div>
              <div class="col-6 col-md-3"><label class="form-label small mb-0">Ref (last 4)</label><input class="form-control form-control-sm" maxlength="40" [(ngModel)]="f.digirefno"></div>
            </ng-container>
          </ng-container>
          <div class="col-12 col-md-6" *ngIf="action === 'refund' || action === 'cancel'"><label class="form-label small mb-0">Why</label><input class="form-control form-control-sm" maxlength="200" [(ngModel)]="f.reason" data-testid="cmv-reason"></div>
          <div class="col-12 col-md-6" *ngIf="action === 'notify'"><label class="form-label small mb-0">Note (optional)</label><input class="form-control form-control-sm" maxlength="200" [(ngModel)]="f.note" placeholder="e.g. will come on Saturday"></div>
        </div>
        <div class="small text-muted mt-2" *ngIf="action === 'cancel' && c.held > 0">The &#8377;{{c.held | number:'1.2-2'}} held is paid back in this step; only a Store Head or the owner can do that.</div>
        <div class="small text-muted mt-2" *ngIf="action === 'pay' || (action === 'refund' && f.mode !== 'WALLET')">It is counted in the shift that is open now.</div>
        <div class="alert alert-danger py-2 small mt-2 mb-0" *ngIf="formError" data-testid="cmv-form-error">{{formError}}</div>
        <div class="mt-2 d-flex gap-2">
          <button type="button" class="btn btn-sm btn-primary" (click)="submit()" [disabled]="busy" data-testid="cmv-submit">Confirm</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="action = ''">Back</button>
        </div>
      </div>

      <h6>Items</h6>
      <div class="hist-card mb-3">
        <table class="table table-sm align-middle mb-0" data-testid="cmv-lines">
          <thead><tr><th>Product</th><th class="text-end">Packs</th><th class="text-end">Price</th><th>Purchase</th><th class="text-end">Arrived</th></tr></thead>
          <tbody>
            <tr *ngFor="let l of c.lines" data-testid="cmv-line">
              <td>{{l.title}}<span class="badge bg-warning text-dark ms-1" *ngIf="!l.product_id" title="Not in the product list yet: purchasing links it before it can be ordered">not in the list</span></td>
              <td class="text-end">{{l.qty}}</td>
              <td class="text-end">{{l.agreed_price !== null ? (l.agreed_price | number:'1.2-2') : ''}}</td>
              <td class="small">
                <span *ngIf="l.request_id">Request #{{l.request_id}} <span class="text-muted">({{l.request_status}})</span></span>
                <ng-container *ngIf="!l.request_id && open">
                  <span class="text-muted">not ordered</span>
                  <span *ngIf="linkable(l).length"> &middot; link to
                    <select class="form-select form-select-sm d-inline-block w-auto" (change)="link(l, $any($event.target).value)" [attr.data-testid]="'cmv-link-' + l.id"><option value="">a request...</option><option *ngFor="let r of linkable(l)" [value]="r.id">#{{r.id}} ({{r.status}}, {{r.qty}} packs)</option></select></span>
                </ng-container>
              </td>
              <td class="text-end" [class.text-success]="l.qty_received >= l.qty">{{l.qty_received}} / {{l.qty}}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h6>Money</h6>
      <div class="hist-card">
        <table class="table table-sm mb-0" data-testid="cmv-payments">
          <thead><tr><th>When</th><th>What</th><th>How</th><th>Shift</th><th>By</th><th class="text-end">Amount</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of c.payments" data-testid="cmv-payment">
              <td class="small">{{p.created_on | date:'dd MMM HH:mm'}}</td>
              <td class="small">{{kindLabel(p.kind)}}<div class="text-muted" *ngIf="p.note">{{p.note}}</div></td>
              <td class="small">{{p.mode === 'DIGITAL' ? (p.digi_method || 'Digital') + (p.digi_ref ? ' ' + p.digi_ref : '') : (p.mode === 'WALLET' ? 'Wallet' : (p.mode === 'CASH' ? 'Cash' : ''))}}</td>
              <td class="small">{{p.shift_name || (p.shift_id ? '#' + p.shift_id : '')}}</td>
              <td class="small">{{p.by_name}}</td>
              <td class="text-end" [class.text-danger]="p.amount < 0">{{p.amount | number:'1.2-2'}}</td>
            </tr>
            <tr *ngIf="!c.payments.length"><td colspan="6" class="text-muted small">No advance taken.</td></tr>
          </tbody>
        </table>
      </div>
    </div>`
})
export class CommitmentViewComponent implements OnInit {
  c: any = null;
  error = "";
  action = "";
  formError = "";
  busy = false;
  f: any = {};
  requestList: any[] = [];

  constructor(private route: ActivatedRoute, private service: CommitmentsService) {}

  get open(): boolean { return !!this.c && this.c.status !== "COLLECTED" && this.c.status !== "CANCELLED"; }
  get unrequested(): number { return (this.c?.lines || []).filter((l: any) => !l.request_id).length; }
  get actionTitle(): string { return ({ pay: 'Take advance', refund: 'Pay back advance', cancel: 'Cancel this order', notify: 'Customer told' } as any)[this.action] || ''; }
  label(s: string) { return STATUS_LABEL[s] || s; }
  cls(s: string) { return STATUS_CLASS[s] || "bg-secondary"; }
  kindLabel(k: string) { return ({ RECEIPT: "Advance taken", REFUND: "Paid back", APPLIED: "Used on a bill", REVERSAL: "Bill voided, advance back" } as any)[k] || k; }

  ngOnInit() {
    this.load();
    this.service.requests().subscribe(r => this.requestList = r || [], () => this.requestList = []);
  }

  private id(): number { return +this.route.snapshot.paramMap.get("id")!; }

  load() {
    this.service.get(this.id()).subscribe(c => { this.c = c; this.error = ""; }, e => this.error = errorText(e, "Could not load this order."));
  }

  /** the open purchase requests for the same product, that the line could ride on */
  linkable(l: any): any[] {
    if (!l.product_id) return [];
    return this.requestList.filter((r: any) => +r.productid === +l.product_id && ["Open", "Reviewed", "Ordered"].includes(r.status));
  }

  begin(a: string) {
    this.action = a; this.formError = "";
    this.f = { amount: a === "pay" ? Math.max(0, (this.c.total || 0) - (this.c.held || 0)) || null : (a === "refund" ? this.c.held : null), mode: "CASH", digimethod: "UPI", digirefno: "", reason: "", note: "" };
  }

  submit() {
    this.formError = "";
    const id = this.c.id;
    const f = this.f;
    const money = { amount: +f.amount, mode: f.mode, digimethod: f.mode === "DIGITAL" ? f.digimethod : null, digirefno: f.mode === "DIGITAL" ? f.digirefno : null };
    let call;
    if (this.action === "pay") call = this.service.pay(id, money);
    else if (this.action === "refund") call = this.service.refund(id, { ...money, reason: f.reason });
    else if (this.action === "cancel") call = this.service.cancel(id, { reason: f.reason, mode: f.mode, digimethod: money.digimethod, digirefno: money.digirefno });
    else call = this.service.notified(id, { note: f.note });
    this.busy = true;
    call.subscribe(c => { this.busy = false; this.c = c; this.action = ""; }, e => { this.busy = false; this.formError = errorText(e, "That could not be done."); });
  }

  raise() {
    this.busy = true; this.error = "";
    this.service.raiseRequests(this.c.id).subscribe(c => { this.busy = false; this.c = c; }, e => { this.busy = false; this.error = errorText(e, "The purchase requests could not be raised."); });
  }

  link(l: any, requestid: any) {
    if (!requestid) return;
    this.error = "";
    this.service.link(l.id, +requestid).subscribe(c => this.c = c, e => this.error = errorText(e, "The line could not be linked."));
  }
}
