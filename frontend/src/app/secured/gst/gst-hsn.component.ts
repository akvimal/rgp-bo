import { Component, OnInit } from "@angular/core";
import { GstApiService } from "./gst-api.service";

/**
 * Products with no HSN. An HSN never stops a sale or a rate change; it is needed when the return is filed. Fill the gaps from what purchases already carry,
 * from a default for the category (provisional until the Business Head confirms it), or by typing it in.
 */
@Component({
  selector: "app-gst-hsn",
  template: `
  <p class="small text-muted" data-testid="hsn-intro">
    An HSN is needed on the return, not at the counter. Billing and rate changes work without it. Fill the gaps here: take the code the vendor printed on the
    purchase, set a default for a whole category (it stays <em>provisional</em> until you confirm it), or type it in.
  </p>
  <div class="alert alert-danger py-2" *ngIf="error" data-testid="hsn-error">{{error}}</div>
  <div class="alert alert-success py-2" *ngIf="message" data-testid="hsn-message">{{message}}</div>

  <div *ngIf="data">
    <p data-testid="hsn-summary"><strong>{{data.missing}}</strong> of {{data.total}} active products have no HSN of their own.</p>

    <h6 class="text-primary">By category</h6>
    <table class="table table-sm" data-testid="hsn-cats">
      <thead><tr><th>Category</th><th class="text-end">Products</th><th class="text-end">No HSN</th><th>Default HSN</th><th></th></tr></thead>
      <tbody>
        <tr *ngFor="let c of data.categories" data-testid="hsn-cat-row">
          <td>{{c.category}}</td><td class="text-end">{{c.products}}</td><td class="text-end">{{c.missing}}</td>
          <td style="width:14rem" *ngIf="c.category !== '(no category)'">
            <div class="input-group input-group-sm">
              <input class="form-control" maxlength="8" placeholder="4, 6 or 8 digits" [(ngModel)]="catEdit[c.category]" data-testid="hsn-cat-input">
              <span class="input-group-text" *ngIf="c.hsn && !c.confirmed">provisional</span><span class="input-group-text text-success" *ngIf="c.hsn && c.confirmed">confirmed</span>
            </div>
          </td>
          <td *ngIf="c.category === '(no category)'" class="text-muted small">Give the products a category first</td>
          <td class="text-end text-nowrap" *ngIf="c.category !== '(no category)'">
            <button class="btn btn-sm btn-outline-secondary me-1" type="button" (click)="saveCat(c, false)" data-testid="hsn-cat-save">Save as provisional</button>
            <button class="btn btn-sm btn-outline-primary me-1" type="button" (click)="saveCat(c, true)" data-testid="hsn-cat-confirm">Confirm</button>
            <button class="btn btn-sm btn-outline-success" type="button" *ngIf="c.hsn && c.missing" (click)="applyCat(c)" data-testid="hsn-cat-apply">Set on {{c.missing}} product(s)</button>
          </td>
        </tr>
      </tbody>
    </table>

    <h6 class="text-primary mt-4">Products sold lately or in stock, with no HSN</h6>
    <p class="small text-muted">Most sold first. A code the vendor printed on a purchase is offered; accepting it is one click.</p>
    <div class="mb-2" *ngIf="proposals().length"><button class="btn btn-sm btn-outline-primary" type="button" (click)="acceptAll()" data-testid="hsn-accept-all">Take the vendor's code for all {{proposals().length}} that have one</button></div>
    <div class="table-responsive" style="max-height:28rem">
      <table class="table table-sm table-striped" data-testid="hsn-missing">
        <thead><tr><th>Product</th><th>Category</th><th class="text-end">Stock</th><th class="text-end">Sold, 90 days</th><th>Vendor's code</th><th>HSN</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of data.rows" data-testid="hsn-row">
            <td>{{r.title}}</td><td>{{r.category}}</td><td class="text-end">{{r.stock | number:'1.0-0'}}</td><td class="text-end">{{r.sold_90d | number:'1.0-0'}}</td>
            <td><button class="btn btn-sm btn-link p-0" type="button" *ngIf="r.proposed" (click)="take(r)" data-testid="hsn-take">Use {{r.proposed}}</button><span class="text-muted" *ngIf="!r.proposed && r.category_hsn">default {{r.category_hsn}} <span class="small">({{r.category_confirmed ? 'confirmed' : 'provisional'}})</span></span></td>
            <td style="width:11rem"><div class="input-group input-group-sm"><input class="form-control" maxlength="8" [(ngModel)]="typed[r.id]" data-testid="hsn-input"><button class="btn btn-outline-primary" type="button" (click)="type(r)" [disabled]="!typed[r.id]" data-testid="hsn-set">Set</button></div></td>
          </tr>
          <tr *ngIf="!data.rows.length"><td colspan="6" class="text-muted">Nothing to fill: every product sold lately or in stock has an HSN.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  `,
})
export class GstHsnComponent implements OnInit {
  data: any = null;
  catEdit: { [k: string]: string } = {};
  typed: { [k: number]: string } = {};
  error = "";
  message = "";

  constructor(private api: GstApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.missingHsn().subscribe((d: any) => {
      this.data = d;
      d.categories.forEach((c: any) => { if (this.catEdit[c.category] === undefined) this.catEdit[c.category] = c.hsn || ''; });
    }, (e) => this.fail(e, 'Could not load the products.'));
  }

  private fail(e: any, fallback: string) { this.error = e?.error?.message || fallback; this.message = ''; }
  private ok(m: string) { this.message = m; this.error = ''; this.load(); }

  proposals() { return (this.data?.rows || []).filter((r: any) => r.proposed); }

  take(r: any) { this.api.setHsn([{ product_id: r.id }]).subscribe(() => this.ok(`HSN set for ${r.title}.`), (e) => this.fail(e, 'Could not set the HSN.')); }

  type(r: any) { this.api.setHsn([{ product_id: r.id, hsn: this.typed[r.id] }]).subscribe(() => { delete this.typed[r.id]; this.ok(`HSN set for ${r.title}.`); }, (e) => this.fail(e, 'Could not set the HSN.')); }

  acceptAll() {
    const items = this.proposals().slice(0, 500).map((r: any) => ({ product_id: r.id }));
    this.api.setHsn(items).subscribe((r: any) => this.ok(`HSN set for ${r.updated} product(s) from their purchases.`), (e) => this.fail(e, 'Could not set the HSN.'));
  }

  saveCat(c: any, confirm: boolean) {
    this.api.setCategoryHsn({ category: c.category, hsn: this.catEdit[c.category], confirm }).subscribe(
      () => this.ok(confirm ? `${c.category}: default HSN confirmed.` : `${c.category}: default HSN saved as provisional.`), (e) => this.fail(e, 'Could not save the default.'));
  }

  applyCat(c: any) { this.api.applyCategoryHsn(c.category).subscribe((r: any) => this.ok(`${c.category}: HSN set on ${r.updated} product(s).`), (e) => this.fail(e, 'Could not apply the default.')); }
}
