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
        <ng-container *ngIf="sum.report as rp">
        <div data-testid="gsm-report">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="fw-semibold">Sales and returns <span class="badge bg-secondary ms-1" *ngIf="rp.snapshot">as it stood when the month was closed</span></div>
            <button class="btn btn-sm btn-outline-secondary" type="button" (click)="downloadReport()" data-testid="gsm-report-xlsx">Excel</button>
          </div>

          <table class="table table-sm mb-3" data-testid="gsm-supplies">
            <thead><tr><th>Supplies</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th><th class="text-end">Total</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of rp.supplies.rows"><td><a href="#" class="text-decoration-underline" (click)="showItems(r.rate, $event)" [attr.data-testid]="'gsm-rate-' + r.rate" title="See every sale at this rate">{{r.rate}}%</a></td><td class="text-end">{{r.taxable | number:'1.2-2'}}</td><td class="text-end">{{r.cgst | number:'1.2-2'}}</td><td class="text-end">{{r.sgst | number:'1.2-2'}}</td><td class="text-end">{{r.igst | number:'1.2-2'}}</td><td class="text-end">{{r.total | number:'1.2-2'}}</td></tr>
              <tr *ngIf="!rp.supplies.rows.length"><td colspan="6" class="text-muted">No tax invoices.</td></tr>
              <tr class="fw-semibold"><td><a href="#" class="text-decoration-underline" (click)="showItems(null, $event)" data-testid="gsm-rate-all" title="See every sale of the month">Total</a></td><td class="text-end">{{rp.supplies.total.taxable | number:'1.2-2'}}</td><td class="text-end">{{rp.supplies.total.cgst | number:'1.2-2'}}</td><td class="text-end">{{rp.supplies.total.sgst | number:'1.2-2'}}</td><td class="text-end">{{rp.supplies.total.igst | number:'1.2-2'}}</td><td class="text-end">{{rp.supplies.total.total | number:'1.2-2'}}</td></tr>
            </tbody>
          </table>

          <div class="card card-body mb-3" *ngIf="itemsOpen" data-testid="gsm-items">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="fw-semibold">{{itemsRate === null ? 'All sales' : 'Sales at ' + itemsRate + '% GST'}} <span class="small text-muted fw-normal" *ngIf="items">{{items.totals.lines}} line(s), {{items.totals.qty | number:'1.0-0'}} unit(s)</span></div>
              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="closeItems()" data-testid="gsm-items-close">Close</button>
            </div>
            <div class="small text-muted" *ngIf="itemsLoading">Loading...</div>
            <ng-container *ngIf="items">
              <input class="form-control form-control-sm mb-2" style="max-width:22rem" placeholder="Find a product, bill number or customer" [(ngModel)]="itemFilter" data-testid="gsm-items-find">
              <div class="table-responsive" style="max-height:22rem">
                <table class="table table-sm table-striped mb-1">
                  <thead style="position:sticky;top:0" class="table-light"><tr><th>Bill</th><th>Date</th><th>Product</th><th>Batch</th><th class="text-end">Qty</th><th class="text-end">GST</th><th class="text-end">Line total</th><th class="text-end">Discount</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let i of filteredItems">
                      <td class="text-nowrap">{{i.doc_no}}<span class="badge bg-secondary ms-1" *ngIf="i.type === 'Cash memo'">memo</span></td><td class="text-nowrap">{{i.date}}</td><td>{{i.product}}</td><td>{{i.batch}}</td>
                      <td class="text-end">{{i.qty}}</td><td class="text-end">{{i.rate}}%</td><td class="text-end">{{i.gross | number:'1.2-2'}}</td>
                      <td class="text-end">{{i.discount === null ? '' : (i.discount | number:'1.2-2')}}</td><td class="text-end">{{i.taxable === null ? '' : (i.taxable | number:'1.2-2')}}</td>
                      <td class="text-end">{{i.cgst === null ? '' : (i.cgst | number:'1.2-2')}}</td><td class="text-end">{{i.sgst === null ? '' : (i.sgst | number:'1.2-2')}}</td><td class="text-end">{{i.igst === null ? '' : (i.igst | number:'1.2-2')}}</td>
                    </tr>
                    <tr *ngIf="!filteredItems.length"><td colspan="12" class="text-muted">Nothing found.</td></tr>
                  </tbody>
                  <tfoot class="fw-semibold"><tr><td colspan="4">Total of all {{items.totals.lines}} line(s)</td><td class="text-end">{{items.totals.qty | number:'1.0-0'}}</td><td></td><td class="text-end">{{items.totals.gross | number:'1.2-2'}}</td><td class="text-end">{{items.totals.discount | number:'1.2-2'}}</td><td class="text-end">{{items.totals.taxable | number:'1.2-2'}}</td><td class="text-end">{{items.totals.cgst | number:'1.2-2'}}</td><td class="text-end">{{items.totals.sgst | number:'1.2-2'}}</td><td class="text-end">{{items.totals.igst | number:'1.2-2'}}</td></tr></tfoot>
                </table>
              </div>
              <div class="small text-warning" *ngIf="items.truncated">Only the first {{items.items.length}} lines are listed here. The Excel has every sale on its "Sales items" sheet.</div>
              <div class="small text-muted">Each line carries its share of the bill's discount and tax, so the lines of a rate add up to the row above.</div>
            </ng-container>
          </div>

          <table class="table table-sm mb-3" data-testid="gsm-returns">
            <thead><tr><th>Returns (credit notes)</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th><th class="text-end">Total</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of rp.returns.rows"><td>{{r.rate}}%</td><td class="text-end">{{r.taxable | number:'1.2-2'}}</td><td class="text-end">{{r.cgst | number:'1.2-2'}}</td><td class="text-end">{{r.sgst | number:'1.2-2'}}</td><td class="text-end">{{r.igst | number:'1.2-2'}}</td><td class="text-end">{{r.total | number:'1.2-2'}}</td></tr>
              <tr *ngIf="!rp.returns.rows.length"><td colspan="6" class="text-muted">No credit notes.</td></tr>
              <tr *ngIf="rp.returns.cash_returns.count"><td colspan="5">Returns of cash memos ({{rp.returns.cash_returns.count}})</td><td class="text-end">{{rp.returns.cash_returns.amount | number:'1.2-2'}}</td></tr>
              <tr class="fw-semibold table-light"><td>Net of returns</td><td class="text-end">{{rp.net.total.taxable | number:'1.2-2'}}</td><td class="text-end">{{rp.net.total.cgst | number:'1.2-2'}}</td><td class="text-end">{{rp.net.total.sgst | number:'1.2-2'}}</td><td class="text-end">{{rp.net.total.igst | number:'1.2-2'}}</td><td class="text-end">{{rp.net.total.total | number:'1.2-2'}}</td></tr>
            </tbody>
          </table>

          <details class="mb-3" data-testid="gsm-buckets">
            <summary class="small fw-semibold">B2B and B2C, in state and out of state</summary>
            <table class="table table-sm mt-2">
              <thead><tr><th>Buyer and place</th><th class="text-end">Rate</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th></tr></thead>
              <tbody><tr *ngFor="let b of rp.buckets"><td>{{b.buyer}}, {{b.place === 'INTER' ? 'out of state' : 'in state'}}</td><td class="text-end">{{b.rate}}%</td><td class="text-end">{{b.taxable | number:'1.2-2'}}</td><td class="text-end">{{b.cgst | number:'1.2-2'}}</td><td class="text-end">{{b.sgst | number:'1.2-2'}}</td><td class="text-end">{{b.igst | number:'1.2-2'}}</td></tr></tbody>
            </table>
          </details>

          <div class="mb-3" *ngIf="rp.nil.length" data-testid="gsm-nil">
            <div class="small fw-semibold">Nil-rated, exempt and non-GST (the 0% supplies)</div>
            <table class="table table-sm mt-1">
              <thead><tr><th>Kind</th><th class="text-end">Supplied</th><th class="text-end">Returned</th><th class="text-end">Net</th></tr></thead>
              <tbody><tr *ngFor="let n of rp.nil"><td>{{n.label}}, {{n.buyer}}, {{n.place === 'INTER' ? 'out of state' : 'in state'}}</td><td class="text-end">{{n.supplied | number:'1.2-2'}}</td><td class="text-end">{{n.returned | number:'1.2-2'}}</td><td class="text-end">{{n.net | number:'1.2-2'}}</td></tr></tbody>
            </table>
          </div>

          <div class="small mb-2" data-testid="gsm-tie">
            Bills total &#8377;{{rp.tie_out.bills_total | number:'1.2-2'}} = taxable value and tax &#8377;{{rp.tie_out.taxable_and_tax | number:'1.2-2'}} + round-off &#8377;{{rp.tie_out.round_off | number:'1.2-2'}}.
            <span class="badge" [ngClass]="rp.tie_out.ok ? 'bg-success' : 'bg-warning text-dark'">{{rp.tie_out.ok ? 'matches' : 'check the bills'}}</span>
          </div>
          <div class="small text-muted mb-3" data-testid="gsm-docs">
            {{rp.documents.issued}} tax invoice(s){{rp.documents.first ? ', ' + rp.documents.first + ' to ' + rp.documents.last : ''}}; {{rp.documents.cancelled}} cancelled.
            <span *ngIf="rp.cash_memos?.count"> {{rp.cash_memos.count}} cash memo(s) (&#8377;{{rp.cash_memos.total | number:'1.2-2'}}) are not tax invoices.</span>
          </div>
        </div>

        <div class="mb-3" *ngIf="kinds?.categories?.length" data-testid="gsm-kinds">
          <div class="small fw-semibold">What kind of 0% supply is each category? <span class="text-muted fw-normal">(set once, as your CA says; kept as the default)</span></div>
          <table class="table table-sm mt-1">
            <thead><tr><th>Category</th><th class="text-end">Sales at 0%</th><th style="width:11rem">Kind</th></tr></thead>
            <tbody>
              <tr *ngFor="let k of kinds.categories">
                <td>{{k.category}} <span class="small text-muted">{{k.products}} product(s)</span></td>
                <td class="text-end">{{k.value | number:'1.2-2'}}</td>
                <td>
                  <select class="form-select form-select-sm" [ngModel]="k.kind || ''" (ngModelChange)="setKind(k, $event)" [disabled]="!!sum.closed || k.category === '(no category)'" [attr.data-testid]="'gsm-kind-' + k.category">
                    <option value="">Nil-rated (not set)</option><option value="NIL_RATED">Nil-rated</option><option value="EXEMPT">Exempt</option><option value="NON_GST">Non-GST</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </ng-container>

        <div class="mb-3" *ngIf="adj?.any" data-testid="gsm-adjustments">
          <div class="small fw-semibold">Adjustments to review <span class="text-muted fw-normal">(not sales, but they touch the return; whether any input credit is reversed is for your CA)</span></div>

          <ng-container *ngFor="let sec of adjSections">
            <div class="small mt-2" *ngIf="adj[sec.key].rows.length" [attr.data-testid]="'gsm-adj-' + sec.key">
              <div class="fw-semibold">{{sec.title}}</div>
              <table class="table table-sm mb-1">
                <thead><tr><th>Source</th><th class="text-end">GST</th><th class="text-end">Units</th><th class="text-end">Value before GST</th><th class="text-end">GST paid</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of adj[sec.key].rows"><td>{{r.label}}<span *ngIf="r.reason_label"> - {{r.reason_label}}</span></td><td class="text-end">{{r.rate}}%</td><td class="text-end">{{r.qty | number:'1.0-0'}}</td><td class="text-end">{{r.taxable | number:'1.2-2'}}</td><td class="text-end">{{r.tax | number:'1.2-2'}}</td></tr>
                  <tr class="fw-semibold"><td colspan="2">Total</td><td class="text-end">{{adj[sec.key].total.qty | number:'1.0-0'}}</td><td class="text-end">{{adj[sec.key].total.taxable | number:'1.2-2'}}</td><td class="text-end">{{adj[sec.key].total.tax | number:'1.2-2'}}</td></tr>
                </tbody>
              </table>
              <div *ngIf="sec.key === 'given_out'">Value at MRP: &#8377;{{adj.given_out.total.mrp | number:'1.2-2'}}</div>
              <div class="text-muted" *ngIf="sec.note">{{sec.note}}</div>
            </div>
          </ng-container>
        </div>
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
  kinds: any = null;
  adj: any = null;
  /** the sales behind a rate of the report, opened by a click on the rate */
  itemsOpen = false;
  itemsRate: number | null = null;
  items: any = null;
  itemsLoading = false;
  itemFilter = '';
  readonly adjSections = [
    { key: 'write_offs', title: 'Stock written off (expired, near expiry, damaged)', note: 'The GST paid on this stock when it was bought may need reversing as input credit.' },
    { key: 'given_out', title: 'Goods given out without a sale (free samples, gifts, own use)', note: 'May count as a supply for GST. Valued at cost before GST, with the GST at the purchase rate and the MRP for reference; your CA decides the value and whether tax is due.' },
    { key: 'vendor_passes', title: 'Returned to the vendor on an out-pass', note: '' },
    { key: 'vendor_returns', title: 'Vendor returns made this month', note: 'A return the vendor has not yet credited lowers the input credit when the credit note comes.' },
    { key: 'credits_applied', title: 'Vendor credits applied on purchase invoices this month', note: '' },
  ];
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
    this.month = month; this.sum = null; this.hsn = null; this.kinds = null; this.adj = null; this.itemsOpen = false; this.items = null; this.error = ''; this.acceptHsn = false; this.arn = ''; this.filedOn = ''; this.reason = '';
    this.api.monthlySummary(month).subscribe((s: any) => this.sum = s, (e) => this.fail(e, 'Could not load the summary.'));
    this.api.hsnSummary(month).subscribe((h: any) => this.hsn = h, () => {});
    this.api.supplyKinds(month).subscribe((k: any) => this.kinds = k, () => {});
    this.api.adjustments(month).subscribe((a: any) => this.adj = a, () => {});
  }

  /** every sale line at a GST rate (every rate when null) for the month in view */
  showItems(rate: number | null, ev?: Event) {
    ev?.preventDefault();
    this.itemsOpen = true; this.itemsRate = rate; this.items = null; this.itemsLoading = true; this.itemFilter = '';
    this.api.salesItems(this.month, rate).subscribe((r: any) => { this.items = r; this.itemsLoading = false; }, (e) => { this.itemsLoading = false; this.itemsOpen = false; this.fail(e, 'Could not load the sales.'); });
  }

  closeItems() { this.itemsOpen = false; this.items = null; }

  get filteredItems(): any[] {
    const q = this.itemFilter.trim().toLowerCase();
    const all: any[] = this.items?.items || [];
    return q ? all.filter((i) => `${i.product} ${i.doc_no} ${i.customer} ${i.batch ?? ''}`.toLowerCase().includes(q)) : all;
  }

  /** the CA's answer for a category: nil-rated, exempt or non-GST; kept as the default and used in the report straight away */
  setKind(k: any, kind: string) {
    this.error = this.message = '';
    this.api.setSupplyKind({ category: k.category, kind: kind || null }).subscribe(() => {
      this.api.salesReport(this.month).subscribe((r: any) => { if (this.sum) this.sum.report = r; }, () => {});
      this.api.supplyKinds(this.month).subscribe((x: any) => this.kinds = x, () => {});
    }, (e) => this.fail(e, 'Could not save the kind.'));
  }

  downloadReport() {
    this.api.file('sales-report/xlsx', this.month).subscribe((b: Blob) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `monthly-sales-report-${this.month}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
    }, (e) => this.fail(e, 'Could not download the report.'));
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
