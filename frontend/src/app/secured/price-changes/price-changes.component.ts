import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { StoreContextService } from "src/app/@core/store-context.service";
import { PriceChangesService } from "./price-changes.service";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The price changes staff sheet: what changed in the sale prices over a period, grouped into "came down" and "went up", with what the customer pays now
 * (GST included). For the counter to read, or to print and keep beside the till.
 */
@Component({
  selector: 'app-price-changes',
  templateUrl: './price-changes.component.html',
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .price-sheet .print-only { display: none; }
    .price-sheet table td, .price-sheet table th { vertical-align: middle; }
    .price-sheet .chg-down { color: #15803d; font-weight: 600; }
    .price-sheet .chg-up { color: #b91c1c; font-weight: 600; }
    .price-sheet .sec-down h5 { color: #15803d; }
    .price-sheet .sec-up h5 { color: #b91c1c; }
    @media print {
      #header, #sidebar, .no-print { display: none !important; }
      #main, main { margin: 0 !important; padding: 0 !important; }
      .price-sheet .print-only { display: block; }
      .price-sheet table { font-size: 11.5px; }
      .price-sheet tr { break-inside: avoid; }
      .price-sheet h5 { break-after: avoid; }
      .price-sheet .card { border: 0 !important; box-shadow: none !important; }
    }
  `]
})
export class PriceChangesComponent implements OnInit {
  from = '';
  to = '';
  min = 0;
  search = '';
  data: any = null;
  loading = false;
  error = '';
  readonly printedOn = new Date();

  constructor(private service: PriceChangesService, private storeContext: StoreContextService) {}

  ngOnInit() {
    this.range(14);
  }

  /** the store being looked at is the one chosen at the top of the page (prices are the same everywhere; it is only shown on the printout) */
  get storeName(): string {
    const id = this.storeContext.selectedStoreId;
    const s = this.storeContext.stores.find((x: any) => Number(x.id) === Number(id));
    return id && s ? (s.name || s.location || '') : '';
  }

  range(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    this.from = ymd(from);
    this.to = ymd(to);
    this.load();
  }

  thisMonth() {
    const n = new Date();
    this.from = ymd(new Date(n.getFullYear(), n.getMonth(), 1));
    this.to = ymd(n);
    this.load();
  }

  lastMonth() {
    const n = new Date();
    this.from = ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1));
    this.to = ymd(new Date(n.getFullYear(), n.getMonth(), 0));
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';
    this.service.get(this.from, this.to, +this.min || 0).subscribe({
      next: (d: any) => { this.data = d; this.loading = false; },
      error: (e: any) => {
        this.loading = false;
        const m = e?.error?.message;
        this.error = (Array.isArray(m) ? m.join(' ') : m) || 'Could not load the price changes.';
      }
    });
  }

  private narrow(list: any[]): any[] {
    const q = this.search.trim().toLowerCase();
    return q ? (list || []).filter((c: any) => String(c.title).toLowerCase().includes(q)) : (list || []);
  }
  get decreased(): any[] { return this.narrow(this.data?.decreased); }
  get increased(): any[] { return this.narrow(this.data?.increased); }

  print() { window.print(); }
}
