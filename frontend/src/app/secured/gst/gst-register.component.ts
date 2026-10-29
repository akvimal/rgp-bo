import { Component, OnInit } from "@angular/core";
import { saveAs } from "file-saver";
import { GstApiService } from "./gst-api.service";

/**
 * The sales register of a month: tax invoices rate by rate, credit notes, cash memos and their returns. The Excel is what the auditor takes (sales and
 * returns first); the Business Head can file from the same figures on the portal.
 */
@Component({
  selector: "app-gst-register",
  template: `
  <div class="d-flex flex-wrap align-items-end gap-2 mb-3">
    <div><label class="form-label mb-0 small">Month</label><input type="month" class="form-control form-control-sm" [(ngModel)]="month" (change)="load()" data-testid="grg-month"></div>
    <button class="btn btn-sm btn-outline-secondary" type="button" (click)="download('xlsx')" [disabled]="!data" data-testid="grg-xlsx"><i class="bi bi-file-earmark-excel"></i> Sales and returns (Excel)</button>
    <button class="btn btn-sm btn-outline-primary" type="button" (click)="download('pack')" [disabled]="!data" data-testid="grg-pack"><i class="bi bi-folder2-open"></i> Records pack for the auditor</button>
  </div>
  <div class="alert alert-danger py-2" *ngIf="error" data-testid="grg-error">{{error}}</div>

  <div *ngIf="data">
    <div class="row g-3 mb-3" data-testid="grg-totals">
      <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Tax invoices</div><div class="fs-5">{{data.totals.tax_invoices}}</div><div class="small">&#8377;{{data.totals.tax_invoice_total | number:'1.0-0'}}</div></div></div>
      <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Credit notes</div><div class="fs-5">{{data.totals.credit_notes}}</div><div class="small">&#8377;{{data.totals.credit_note_total | number:'1.0-0'}}</div></div></div>
      <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Net tax on documents</div><div class="fs-5">&#8377;{{data.totals.net.tax | number:'1.2-2'}}</div><div class="small">on &#8377;{{data.totals.net.taxable | number:'1.0-0'}} taxable</div></div></div>
      <div class="col-6 col-md-3"><div class="border rounded p-2"><div class="small text-muted">Cash memos</div><div class="fs-5">{{data.totals.cash_bills}}</div><div class="small">&#8377;{{data.totals.cash_total | number:'1.0-0'}}, returns &#8377;{{data.totals.cash_returns_total | number:'1.0-0'}}</div></div></div>
    </div>
    <div class="alert alert-warning py-2 small" *ngIf="data.gaps.length" data-testid="grg-gaps">Numbers missing from the invoice series: {{data.gaps.join(', ')}}.</div>

    <h6 class="text-primary">Tax invoices</h6>
    <div class="table-responsive" style="max-height:24rem">
      <table class="table table-sm table-striped" data-testid="grg-invoices">
        <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Buyer GSTIN</th><th>Place</th><th class="text-end">GST</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th><th class="text-end">Total</th></tr></thead>
        <tbody>
          <ng-container *ngFor="let i of taxInvoices()">
            <tr *ngFor="let r of i.rates; let first = first" data-testid="grg-invoice-row">
              <td>{{first ? i.doc_no : ''}}</td><td>{{first ? (i.date | date:'dd MMM') : ''}}</td><td>{{first ? i.customer : ''}}</td><td>{{first ? i.buyer_gstin : ''}}</td><td>{{first ? i.place_of_supply : ''}}</td>
              <td class="text-end">{{r.rate}}%</td><td class="text-end">{{r.taxable | number:'1.2-2'}}</td><td class="text-end">{{r.cgst | number:'1.2-2'}}</td><td class="text-end">{{r.sgst | number:'1.2-2'}}</td><td class="text-end">{{r.igst | number:'1.2-2'}}</td>
              <td class="text-end">{{r.taxable + r.tax | number:'1.2-2'}}</td>
            </tr>
          </ng-container>
          <tr *ngIf="!taxInvoices().length"><td colspan="11" class="text-muted">{{data.registered ? 'No tax invoices this month.' : 'Not registered: bills are cash memos, listed below.'}}</td></tr>
        </tbody>
      </table>
    </div>

    <h6 class="text-primary mt-3" *ngIf="data.credit_notes.length">Credit notes</h6>
    <table class="table table-sm" *ngIf="data.credit_notes.length" data-testid="grg-credit-notes">
      <thead><tr><th>Credit note</th><th>Date</th><th>Against invoice</th><th class="text-end">GST</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th><th class="text-end">Total</th></tr></thead>
      <tbody><tr *ngFor="let c of data.credit_notes"><td>{{c.note_no}}</td><td>{{c.date | date:'dd MMM'}}</td><td>{{c.original_invoice_no}}</td><td class="text-end">{{c.rate}}%</td><td class="text-end">{{c.taxable | number:'1.2-2'}}</td><td class="text-end">{{c.cgst | number:'1.2-2'}}</td><td class="text-end">{{c.sgst | number:'1.2-2'}}</td><td class="text-end">{{c.igst | number:'1.2-2'}}</td><td class="text-end">{{c.gross | number:'1.2-2'}}</td></tr></tbody>
    </table>

    <h6 class="text-primary mt-3" *ngIf="cashMemos().length">Cash memos <span class="small text-muted">(no tax shown)</span></h6>
    <div class="table-responsive" style="max-height:16rem" *ngIf="cashMemos().length">
      <table class="table table-sm table-striped" data-testid="grg-cash">
        <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th class="text-end">Total</th></tr></thead>
        <tbody><tr *ngFor="let i of cashMemos()"><td>{{i.doc_no}}</td><td>{{i.date | date:'dd MMM'}}</td><td>{{i.customer}}</td><td class="text-end">{{i.total | number:'1.2-2'}}</td></tr></tbody>
      </table>
    </div>

    <h6 class="text-primary mt-3" *ngIf="data.returns_cash.length">Returns of cash memos</h6>
    <table class="table table-sm" *ngIf="data.returns_cash.length" data-testid="grg-cash-returns">
      <thead><tr><th>Date</th><th>Bill</th><th>Product</th><th class="text-end">Qty</th><th class="text-end">Amount</th></tr></thead>
      <tbody><tr *ngFor="let r of data.returns_cash"><td>{{r.date | date:'dd MMM'}}</td><td>{{r.bill_no}}</td><td>{{r.product}}</td><td class="text-end">{{r.qty}}</td><td class="text-end">{{r.amount | number:'1.2-2'}}</td></tr></tbody>
    </table>
  </div>
  `,
})
export class GstRegisterComponent implements OnInit {
  month = this.thisMonth();
  data: any = null;
  error = "";

  constructor(private api: GstApiService) {}

  ngOnInit() { this.load(); }

  private thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

  taxInvoices() { return (this.data?.invoices || []).filter((i: any) => i.kind === 'TAX'); }
  cashMemos() { return (this.data?.invoices || []).filter((i: any) => i.kind === 'CASH'); }

  load() {
    this.error = ""; this.data = null;
    if (!/^\d{4}-\d{2}$/.test(this.month || '')) return;
    this.api.salesRegister(this.month).subscribe((d: any) => this.data = d, (e) => this.error = e?.error?.message || 'Could not load the register.');
  }

  download(kind: 'xlsx' | 'pack') {
    this.error = "";
    this.api.file(kind === 'xlsx' ? 'sales-register/xlsx' : 'pack', this.month).subscribe(
      (b: Blob) => saveAs(b, kind === 'xlsx' ? `sales-and-returns-${this.month}.xlsx` : `gst-records-pack-${this.month}.xlsx`),
      async (e: any) => { this.error = await this.blobMsg(e, 'Could not make the file.'); });
  }

  private async blobMsg(e: any, fallback: string): Promise<string> {
    try { if (e?.error instanceof Blob) { const t = JSON.parse(await e.error.text()); return t?.message || fallback; } } catch { /* not JSON */ }
    return e?.error?.message || fallback;
  }
}
