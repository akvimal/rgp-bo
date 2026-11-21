import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

/**
 * A product's (or a composition's) price against the price lists loaded under Settings > Reference data (PMBI Jan Aushadhi, other sellers) and against the
 * market. The lists are compared per unit (a tablet); the gap is how much dearer (+) or cheaper (-) the shop is than the cheapest selling price in a list.
 * The market price is read from the web by the assistant when asked, kept a month per composition, and shown with its sources.
 * With a product the shop's own price is shown (and a price being considered, `candidate`, before GST); with only a composition it is the lists alone.
 */
@Component({
  selector: "app-price-compare-panel",
  template: `
    <div class="border rounded p-2" data-testid="price-compare">
      <div class="fw-semibold small">Compare prices <span class="text-muted fw-normal">(per unit, the price a customer pays)</span></div>
      <div class="small text-muted mt-1" *ngIf="loading && !data">Looking...</div>
      <div class="small text-danger mt-1" *ngIf="error" data-testid="cmp-error">{{error}}</div>

      <ng-container *ngIf="data">
        <div class="small text-muted mt-1" *ngIf="!data.known" data-testid="cmp-unknown">There is no composition with a strength on this {{productId ? 'product' : 'medicine'}}, so it cannot be compared. Add it in the product, then try again.</div>
        <ng-container *ngIf="data.known">
          <div class="d-flex flex-wrap gap-4 mt-1" *ngIf="productId" data-testid="cmp-ours">
            <div><div class="small text-muted">Our price now (pack of {{data.pack}})</div><div><span *ngIf="data.price !== null">&#8377;{{data.price | number:'1.2-2'}}</span><span *ngIf="data.price === null">no price</span><span class="text-muted" *ngIf="data.unitPrice !== null"> &middot; &#8377;{{data.unitPrice | number:'1.2-2'}} per unit</span></div></div>
            <div *ngIf="data.candidate !== null"><div class="small text-muted">The price being set</div><div class="fw-semibold" data-testid="cmp-candidate">&#8377;{{data.candidate | number:'1.2-2'}}<span class="text-muted fw-normal"> &middot; &#8377;{{data.candidateUnit | number:'1.2-2'}} per unit</span></div></div>
            <div><div class="small text-muted">MRP</div><div><span *ngIf="data.mrp !== null">&#8377;{{data.mrp | number:'1.2-2'}}</span><span *ngIf="data.mrp === null">-</span><span class="text-muted" *ngIf="data.unitMrp !== null"> &middot; &#8377;{{data.unitMrp | number:'1.2-2'}} per unit</span></div></div>
          </div>

          <div class="small text-muted mt-2" *ngIf="!data.lists" data-testid="cmp-nolists">No price lists are loaded yet (Settings &gt; Reference data).</div>
          <div class="small text-muted mt-2" *ngIf="data.lists && !data.sources.length" data-testid="cmp-nomatch">None of the loaded lists has this composition and form.</div>
          <table class="table table-sm small mt-2 mb-1" *ngIf="data.sources.length" data-testid="cmp-sources">
            <thead><tr><th>List</th><th class="text-end">MRP / unit</th><th class="text-end">Sells at / unit</th><th>Cheapest</th><th class="text-end" *ngIf="productId">Our gap</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of data.sources" data-testid="cmp-source">
                <td><strong>{{s.sourceName}}</strong><div class="text-muted">{{s.items}} item(s)</div></td>
                <td class="text-end">{{range(s.unitMrp)}}</td>
                <td class="text-end">{{range(s.unitSell)}}</td>
                <td><span *ngIf="s.cheapest">{{s.cheapest.name}}<span class="text-muted"> ({{s.cheapest.unitSize}})</span></span>
                  <span *ngIf="!s.cheapest && s.perPackOnly.length" class="text-muted">pack in ml or g: &#8377;{{s.perPackOnly[0].sellPrice || s.perPackOnly[0].mrp | number:'1.2-2'}} for {{s.perPackOnly[0].unitSize}}</span></td>
                <td class="text-end" *ngIf="productId"><span *ngIf="s.gap !== null" class="badge" [ngClass]="s.gap > 0 ? 'bg-danger' : 'bg-success'" data-testid="cmp-gap">{{s.gap > 0 ? '+' : ''}}{{s.gap | number:'1.0-1'}}%</span></td>
              </tr>
            </tbody>
          </table>
          <div class="form-text" *ngIf="data.sources.length && productId">+ means we are dearer than that list's cheapest selling price; - means cheaper. The PMBI Jan Aushadhi list sells at its MRP.</div>
        </ng-container>

        <!-- the market, from the web: on request, kept a month -->
        <div class="mt-2 pt-2 border-top" *ngIf="data.known" data-testid="cmp-market">
          <div class="d-flex align-items-center gap-2">
            <span class="fw-semibold small">Market price (same composition)</span>
            <span class="badge bg-warning text-dark">Indicative &middot; AI, check before use</span>
            <button type="button" class="btn btn-sm btn-outline-primary ms-auto" *ngIf="marketAvailable && !marketBusy" (click)="lookupMarket(!!market)" data-testid="cmp-market-lookup"><i class="bi bi-search"></i> {{market ? 'Look again' : 'Check market price'}}</button>
          </div>
          <div class="small text-muted mt-1" *ngIf="!marketAvailable" data-testid="cmp-market-off">The online lookup needs the assistant, which the Business Head switches on under Settings &gt; AI assistant.</div>
          <div class="small text-muted mt-1" *ngIf="marketBusy">Searching the web... this takes up to a minute.</div>
          <div class="alert alert-danger py-1 small mt-2 mb-0" *ngIf="marketError" data-testid="cmp-market-error">{{marketError}}</div>
          <ng-container *ngIf="market">
            <div *ngIf="market.found" class="mt-2" data-testid="cmp-market-result">
              <div class="d-flex flex-wrap gap-4">
                <div><div class="small text-muted">MRP per unit</div><div data-testid="cmp-market-mrp">{{range(market.unitMrp)}}</div></div>
                <div *ngIf="market.unitSell"><div class="small text-muted">Selling price per unit</div><div data-testid="cmp-market-sell">{{range(market.unitSell)}}<span class="text-muted"> &middot; middle &#8377;{{market.unitSell.median | number:'1.2-2'}}</span></div></div>
                <div *ngIf="productId && marketGap !== null"><div class="small text-muted">Our gap against the middle</div><span class="badge" [ngClass]="marketGap > 0 ? 'bg-danger' : 'bg-success'" data-testid="cmp-market-gap">{{marketGap > 0 ? '+' : ''}}{{marketGap | number:'1.0-1'}}%</span></div>
              </div>
              <div class="small mt-1" *ngIf="market.note">{{market.note}}</div>
              <table class="table table-sm small mt-2 mb-1" *ngIf="market.listings?.length" data-testid="cmp-market-listings">
                <thead><tr><th>Brand</th><th>Site</th><th>Pack</th><th class="text-end">MRP</th><th class="text-end">Sells at</th><th></th></tr></thead>
                <tbody><tr *ngFor="let l of market.listings" [class.text-muted]="l.status !== 'used'">
                  <td>{{l.brand}}</td><td><a *ngIf="l.url" [href]="l.url" target="_blank" rel="noopener noreferrer">{{l.site}}</a><span *ngIf="!l.url">{{l.site}}</span></td><td>{{l.packText || (l.packUnits ? 'pack of ' + l.packUnits : '')}}</td>
                  <td class="text-end"><span *ngIf="l.mrp !== null">&#8377;{{l.mrp | number:'1.2-2'}}</span></td><td class="text-end"><span *ngIf="l.sell !== null">&#8377;{{l.sell | number:'1.2-2'}}</span></td>
                  <td><span class="badge" [ngClass]="l.status === 'used' ? 'bg-success' : l.status === 'differs' ? 'bg-warning text-dark' : 'bg-danger'" [title]="l.problem || ''">{{l.status === 'used' ? 'used' : l.status === 'differs' ? 'differs' : 'not valid'}}</span></td></tr></tbody>
              </table>
              <div class="small" *ngIf="market.sources?.length" data-testid="cmp-market-sources">Sources: <span *ngFor="let s of market.sources; let last = last"><a [href]="s.url" target="_blank" rel="noopener noreferrer">{{s.title || host(s.url)}}</a><span *ngIf="!last">, </span></span></div>
            </div>
            <div *ngIf="!market.found" class="small text-muted mt-2" data-testid="cmp-market-notfound">No market price found online: {{market.note}}</div>
            <div class="small text-muted mt-1" data-testid="cmp-market-asof">As at {{market.asOf | date:'dd MMM yyyy'}}<span *ngIf="market.cached"> (kept from an earlier look)</span><span *ngIf="!market.fresh" class="text-danger"> &middot; more than a month old, look again</span><span *ngIf="market.retryNote"> &middot; the new look found nothing usable, so the earlier answer is kept</span></div>
          </ng-container>
        </div>
      </ng-container>
    </div>`
})
export class PriceComparePanelComponent implements OnChanges, OnDestroy {
  /** a shop product (its price is compared), or only a composition (the lists alone) */
  @Input() productId: number | null = null;
  @Input() composition: string | null = null;
  @Input() form: string | null = null;
  /** a price before GST being considered for the product */
  @Input() candidate: number | null = null;

  data: any = null;
  loading = false;
  error = "";
  market: any = null;
  marketAvailable = false;
  marketBusy = false;
  marketError = "";
  private timer: any = null;
  private seq = 0;
  private lastSubject = "";

  constructor(private http: HttpClient) {}

  ngOnDestroy() { clearTimeout(this.timer); }

  get marketGap(): number | null {
    const ours = this.data?.candidateUnit ?? this.data?.unitPrice;
    const mid = this.market?.unitSell?.median;
    return ours > 0 && mid > 0 ? Math.round(((ours - mid) / mid) * 1000) / 10 : null;
  }

  range(r: { min: number; max: number } | null | undefined): string {
    if (!r) return "-";
    const f = (n: number) => "₹" + n.toFixed(2);
    return r.min === r.max ? f(r.min) : `${f(r.min)} to ${f(r.max)}`;
  }

  host(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }

  /** a new subject loads at once; only a changed price waits a moment (it is typed) */
  ngOnChanges(c: SimpleChanges) {
    const subject = `${this.productId || ""}|${this.composition || ""}|${this.form || ""}`;
    const subjectChanged = subject !== this.lastSubject;
    this.lastSubject = subject;
    if (subjectChanged) { this.data = null; this.market = null; this.marketError = ""; this.error = ""; }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(subjectChanged), subjectChanged ? 0 : 500);
  }

  private load(withMarket: boolean) {
    if (!this.productId && !this.composition) return;
    const mine = ++this.seq;
    this.loading = true;
    const req = this.productId
      ? this.http.get<any>(`${environment.apiHost}/price-compare/product/${this.productId}`, { params: this.candidate && this.candidate > 0 ? { price: String(this.candidate) } : {} })
      : this.http.get<any>(`${environment.apiHost}/price-compare/composition`, { params: { composition: this.composition || "", form: this.form || "" } });
    req.subscribe({
      next: d => { if (mine !== this.seq) return; this.data = d; this.loading = false; this.error = ""; if (withMarket && d?.known) this.loadMarket(); },
      error: e => { if (mine !== this.seq) return; this.loading = false; this.error = this.message(e, "Could not load the comparison."); },
    });
  }

  private subjectParams(): any {
    return this.productId ? { productid: String(this.productId) } : { composition: this.composition || "", form: this.form || "" };
  }

  private message(e: any, fallback: string) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || fallback); }

  /** what an earlier lookup kept (free) and whether the assistant is on */
  private loadMarket() {
    this.http.get<any>(`${environment.apiHost}/price-compare/market`, { params: this.subjectParams() }).subscribe({
      next: d => { this.marketAvailable = !!d?.available; this.market = d?.kept || null; },
      error: () => { this.marketAvailable = false; this.market = null; },
    });
  }

  /** searches the web (it uses the assistant, so it is only done when asked) */
  lookupMarket(refresh: boolean) {
    if (this.marketBusy) return;
    this.marketBusy = true; this.marketError = "";
    const body = { ...(this.productId ? { productid: this.productId } : { composition: this.composition, form: this.form }), refresh };
    this.http.post<any>(`${environment.apiHost}/price-compare/market`, body).subscribe({
      next: d => { this.market = d; this.marketBusy = false; },
      error: e => { this.marketBusy = false; this.marketError = this.message(e, "Could not look up the market price."); },
    });
  }
}
