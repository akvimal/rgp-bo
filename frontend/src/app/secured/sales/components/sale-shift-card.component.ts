import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { CashService } from "../../store/cash/cash.service";
import { DenominationRow } from "src/app/shared/denominations";

/**
 * Till-side shift control for the POS landing. The person at the terminal picks
 * themselves in the Staff dropdown (operator context); this card lets them open
 * the shift with an opening-float count and close it with a drawer count.
 * See docs/planning/CASHIER_SHIFT_CLOSE.md.
 */
@Component({
  selector: "app-sale-shift-card",
  templateUrl: "./sale-shift-card.component.html",
})
export class SaleShiftCardComponent implements OnInit, OnDestroy {
  private subs = new Subscription();

  storeId: number | null = null;
  operatorId: number | null = null;
  operatorName = "";
  openShift: any = null;
  loading = false;
  message = "";

  mode: "" | "open" | "close" = "";
  denoms: DenominationRow[] = [];
  denomTotal = 0;
  busy = false;

  constructor(
    private storeContext: StoreContextService,
    private operatorContext: OperatorContextService,
    private cash: CashService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.storeContext.selectedStoreId$.subscribe((id: any) => {
      this.storeId = id;
      this.refresh();
    }));
    this.subs.add(this.operatorContext.selectedOperatorId$.subscribe((id: any) => (this.operatorId = id)));
    this.subs.add(this.operatorContext.selectedOperatorName$.subscribe((n: any) => (this.operatorName = n || "")));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  refresh(): void {
    if (this.storeId === null || this.storeId === undefined) {
      this.openShift = null;
      return;
    }
    this.loading = true;
    this.cash.getDashboard(this.storeId).subscribe({
      next: (data: any) => {
        this.openShift = data?.openShift || null;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  startOpen(): void {
    this.message = "";
    if (!this.requireOperator()) { return; }
    this.mode = "open";
    this.denoms = [];
    this.denomTotal = 0;
  }

  startClose(): void {
    this.message = "";
    if (!this.requireOperator()) { return; }
    this.mode = "close";
    this.denoms = [];
    this.denomTotal = 0;
  }

  cancel(): void {
    this.mode = "";
    this.message = "";
  }

  get expected(): number {
    return Number(this.openShift?.expectedcash || 0);
  }

  get variance(): number {
    return this.denomTotal - this.expected;
  }

  confirmOpen(): void {
    if (!this.requireOperator()) { return; }
    this.busy = true;
    this.message = "";
    this.cash.createShift({
      storeid: this.storeId,
      assigneduserid: this.operatorId,
      openingdenominations: this.denoms,
    }).subscribe({
      next: () => { this.busy = false; this.mode = ""; this.refresh(); },
      error: (err) => { this.busy = false; this.message = err?.error?.message || "Unable to open the shift"; },
    });
  }

  confirmClose(): void {
    if (!this.openShift?.id || !this.requireOperator()) { return; }
    if (!this.denoms.length || this.denomTotal <= 0) {
      this.message = "Enter the drawer count before closing.";
      return;
    }
    this.busy = true;
    this.message = "";
    this.cash.closeShift(this.openShift.id, {
      counteddenominations: this.denoms,
      closedoperatorid: this.operatorId,
    }).subscribe({
      next: () => { this.busy = false; this.mode = ""; this.refresh(); },
      error: (err) => { this.busy = false; this.message = err?.error?.message || "Unable to close the shift"; },
    });
  }

  private requireOperator(): boolean {
    if (!this.operatorId) {
      this.message = "Select the staff member at the till first (Staff dropdown above).";
      return false;
    }
    return true;
  }
}
