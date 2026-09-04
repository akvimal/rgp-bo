import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CASH_DENOMINATIONS, DenominationRow } from "../denominations";

/**
 * Drawer count by denomination. Two-way binds the [{d,n}] array and also emits
 * the running total. Used for both the opening float and the closing count.
 */
@Component({
  selector: "app-denomination-grid",
  templateUrl: "./denomination-grid.component.html",
  styles: [`
    .denom-grid { max-width: 22rem; }
    .denom-grid td { padding: .2rem .4rem; vertical-align: middle; }
    .denom-grid input { width: 4.5rem; text-align: right; }
    .denom-grid .face { width: 3.5rem; text-align: right; font-variant-numeric: tabular-nums; }
    .denom-grid .sub { text-align: right; font-variant-numeric: tabular-nums; color: var(--bs-secondary-color, #6c757d); }
    .denom-grid .total-row td { border-top: 1px solid #dee2e6; font-weight: 600; }
  `],
})
export class DenominationGridComponent {
  denoms = CASH_DENOMINATIONS;
  counts: { [d: number]: number | null } = {};

  @Input() set rows(value: DenominationRow[] | null | undefined) {
    const next: { [d: number]: number | null } = {};
    (value || []).forEach((row) => {
      if (this.denoms.includes(Number(row?.d))) {
        next[Number(row.d)] = Number(row.n) || 0;
      }
    });
    this.counts = next;
  }

  @Input() disabled = false;

  @Output() rowsChange = new EventEmitter<DenominationRow[]>();
  @Output() totalChange = new EventEmitter<number>();

  get total(): number {
    return this.denoms.reduce((sum, d) => sum + d * (Number(this.counts[d]) || 0), 0);
  }

  sub(d: number): number {
    return d * (Number(this.counts[d]) || 0);
  }

  onChange(): void {
    const rows = this.denoms
      .filter((d) => (Number(this.counts[d]) || 0) > 0)
      .map((d) => ({ d, n: Number(this.counts[d]) }));
    this.rowsChange.emit(rows);
    this.totalChange.emit(this.total);
  }
}
