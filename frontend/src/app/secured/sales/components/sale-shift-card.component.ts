import { Component, OnDestroy, OnInit } from "@angular/core";
import { ConfirmationService } from "primeng/api";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { ShiftContextService } from "src/app/@core/shift-context.service";
import { CashService } from "../../store/cash/cash.service";
import { DenominationRow } from "src/app/shared/denominations";
import { CLOSING_CHECKLIST_ITEMS, ChecklistItem, OPENING_CHECKLIST_ITEMS, freshChecklist } from "src/app/shared/shift-checklist";

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
  message = "";

  mode: "" | "open" | "close" = "";
  denoms: DenominationRow[] = [];
  denomTotal = 0;
  busy = false;
  checklist: ChecklistItem[] = [];

  constructor(
    private storeContext: StoreContextService,
    private operatorContext: OperatorContextService,
    private shiftContext: ShiftContextService,
    private cash: CashService,
    private confirmation: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.storeContext.selectedStoreId$.subscribe((id: any) => {
      this.storeId = id;
      this.shiftContext.refresh(id);
    }));
    this.subs.add(this.shiftContext.openShift$.subscribe((s: any) => {
      this.openShift = s;
      if (!s && this.mode === "close") { this.mode = ""; }
    }));
    this.subs.add(this.operatorContext.selectedOperatorId$.subscribe((id: any) => (this.operatorId = id)));
    this.subs.add(this.operatorContext.selectedOperatorName$.subscribe((n: any) => (this.operatorName = n || "")));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  refresh(): void {
    this.shiftContext.reload();
  }

  startOpen(): void {
    this.message = "";
    if (!this.requireOperator()) { return; }
    this.mode = "open";
    this.denoms = [];
    this.denomTotal = 0;
    this.checklist = freshChecklist(OPENING_CHECKLIST_ITEMS);
  }

  startClose(): void {
    this.message = "";
    if (!this.requireOperator()) { return; }
    this.mode = "close";
    this.denoms = [];
    this.denomTotal = 0;
    this.checklist = freshChecklist(CLOSING_CHECKLIST_ITEMS);
  }

  get checklistComplete(): boolean {
    return this.checklist.length > 0 && this.checklist.every((c) => c.checked);
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
    if (!this.checklistComplete) {
      this.message = "Complete the opening checklist before opening the shift.";
      return;
    }
    if (this.denomTotal <= 0) {
      this.confirmation.confirm({
        header: "Open with no float?",
        message: "No opening cash has been counted. Open this shift with a &#8377;0 float?",
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "Open with &#8377;0",
        rejectLabel: "Cancel",
        accept: () => this.submitOpen(true),
      });
      return;
    }
    this.submitOpen(false);
  }

  private submitOpen(allowZero: boolean): void {
    this.busy = true;
    this.message = "";
    this.cash.createShift({
      storeid: this.storeId,
      assigneduserid: this.operatorId,
      openingdenominations: this.denoms,
      openingchecklist: this.checklist.map((c) => c.key),
      allowZero,
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
    if (!this.checklistComplete) {
      this.message = "Complete the closing checklist before closing the shift.";
      return;
    }
    this.busy = true;
    this.message = "";
    this.cash.closeShift(this.openShift.id, {
      counteddenominations: this.denoms,
      closedoperatorid: this.operatorId,
      closingchecklist: this.checklist.map((c) => c.key),
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
