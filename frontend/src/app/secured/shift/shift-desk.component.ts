import { Component, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfirmationService } from "primeng/api";
import { Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { StoreContextService } from "src/app/@core/store-context.service";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { ShiftContextService } from "src/app/@core/shift-context.service";
import { CashService } from "../store/cash/cash.service";
import { EXPENSE_CATEGORIES } from "../store/cash/expense-categories";
import { DenominationRow } from "src/app/shared/denominations";
import { CLOSING_CHECKLIST_ITEMS, ChecklistItem, HANDOVER_CHECKLIST_ITEMS, OPENING_CHECKLIST_ITEMS, OPENING_OPEN_STORE_CHECKLIST_ITEMS, freshChecklist } from "src/app/shared/shift-checklist";

/**
 * Where staff open and close their shift (it used to sit on top of the POS). Opening counts the float; closing shows
 * the takings by tender, the cash drawer's expenses and the digital totals to match, and ends either the day or, when the
 * store stays open, hands the drawer to the next person.
 */
@Component({ selector: "app-shift-desk", templateUrl: "./shift-desk.component.html" })
export class ShiftDeskComponent implements OnInit, OnDestroy {
  private subs = new Subscription();

  storeId: number | null = null;
  operatorId: number | null = null;
  operatorName = "";
  openShift: any = null;
  staffBased = false;
  /** who can be at the counter, and whether this store asks (a staff-based store that does not ask uses the signed-in person) */
  operators: any[] = [];
  selfOnly = false;
  summary: any = null;
  message = "";
  error = "";
  busy = false;

  mode: "" | "open" | "close" = "";
  denoms: DenominationRow[] = [];
  denomTotal = 0;
  checklist: ChecklistItem[] = [];
  /** how the store stands as a shift is opened: already open (a handover, a later shift) or being opened for the day */
  openingContext: any = null;
  /** the checklists in force for this store (its own, the business's or the standard); the built-in ones when they cannot be fetched */
  lists: any = null;

  closeType: "END_OF_DAY" | "HANDOVER" = "END_OF_DAY";
  handoverTo: number | null = null;
  staff: any[] = [];
  digitalCounted: { [provider: string]: any } = {};

  expenseForm: any = null;
  readonly categories = EXPENSE_CATEGORIES;

  constructor(
    private storeContext: StoreContextService,
    private operatorContext: OperatorContextService,
    private shiftContext: ShiftContextService,
    private cash: CashService,
    private http: HttpClient,
    private confirmation: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.storeContext.selectedStoreId$.subscribe((id: any) => {
      this.storeId = id;
      this.shiftContext.refresh(id);
      this.loadStaff();
    }));
    this.subs.add(this.shiftContext.profile$.subscribe((p: any) => { this.staffBased = p?.shiftmode === "staff"; if (this.staffBased) this.closeType = "END_OF_DAY"; }));
    this.subs.add(this.shiftContext.openShift$.subscribe((s: any) => {
      this.openShift = s;
      if (!s && this.mode === "close") { this.mode = ""; }
      this.loadSummary();
    }));
    this.subs.add(this.operatorContext.selectedOperatorId$.subscribe((id: any) => (this.operatorId = id)));
    this.subs.add(this.operatorContext.selectedOperatorName$.subscribe((n: any) => (this.operatorName = n || "")));
    this.subs.add(this.operatorContext.operators$.subscribe((o: any) => (this.operators = o || [])));
    this.subs.add(this.operatorContext.selfOnly$.subscribe((v: any) => (this.selfOnly = !!v)));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  /** the counter keeps its choice for a while and then asks again; this is where it is asked on this page */
  pickOperator(id: any) {
    this.operatorContext.setSelectedOperator(id === null || id === "" ? null : Number(id));
    if (this.operatorId) this.error = "";
  }

  private loadStaff() {
    if (!this.storeId) { this.staff = []; return; }
    this.http.get(`${environment.apiHost}/store-cash/users`, { params: { storeid: String(this.storeId) } }).subscribe((r: any) => this.staff = r || [], () => this.staff = []);
  }

  loadSummary() {
    if (!this.openShift?.id) { this.summary = null; return; }
    this.cash.getShiftSummary(this.openShift.id).subscribe(s => this.summary = s, () => this.summary = null);
  }

  // ------------------------------------------------------------ opening
  startOpen() {
    this.message = this.error = "";
    if (!this.requireOperator()) return;
    this.openingContext = null;
    const begin = (ctx: any) => {
      this.openingContext = ctx;
      this.mode = "open"; this.denoms = []; this.denomTotal = 0;
      this.checklist = ctx?.storealreadyopen
        ? freshChecklist(this.itemsFor("OPENING_OPEN_STORE", OPENING_OPEN_STORE_CHECKLIST_ITEMS))
        : freshChecklist(this.itemsFor("OPENING", OPENING_CHECKLIST_ITEMS));
    };
    // if the store cannot say, the full list is the safe one
    this.fetchLists(() => this.http.get(`${environment.apiHost}/store-cash/opening-context`, { params: { storeid: String(this.storeId) } }).subscribe((c: any) => begin(c), () => begin(null)));
  }

  private fetchLists(then: () => void) {
    this.http.get(`${environment.apiHost}/store-cash/checklists`, { params: { storeid: String(this.storeId) } }).subscribe((l: any) => { this.lists = l; then(); }, () => { this.lists = null; then(); });
  }

  /** a list the business or the store has written, else the built-in one */
  private itemsFor(kind: string, fallback: { key: string; label: string }[]) {
    const items = this.lists?.[kind]?.items;
    return Array.isArray(items) ? items : fallback;
  }

  confirmOpen() {
    if (!this.requireOperator()) return;
    if (!this.checklistComplete) { this.error = "Complete the opening checklist before opening the shift."; return; }
    if (this.denomTotal <= 0) {
      this.confirmation.confirm({
        header: "Open with no float?", message: "No opening cash has been counted. Open this shift with a Rs 0 float?", icon: "pi pi-exclamation-triangle",
        acceptLabel: "Open with Rs 0", rejectLabel: "Cancel", accept: () => this.submitOpen(true),
      });
      return;
    }
    this.submitOpen(false);
  }

  private submitOpen(allowZero: boolean) {
    this.busy = true; this.error = "";
    this.cash.createShift({
      storeid: this.storeId, assigneduserid: this.operatorId, openingdenominations: this.denoms,
      openingchecklist: this.checklist.map(c => c.key), openingchecklistat: this.tickTimes(), allowZero,
    }).subscribe({
      next: () => { this.busy = false; this.mode = ""; this.message = "Shift opened."; this.shiftContext.reload(); },
      error: err => { this.busy = false; this.error = err?.error?.message || "Unable to open the shift"; },
    });
  }

  // ------------------------------------------------------------ closing
  startClose() {
    this.message = this.error = "";
    if (!this.requireOperator()) return;
    this.fetchLists(() => {
      this.mode = "close"; this.denoms = []; this.denomTotal = 0;
      this.closeType = "END_OF_DAY"; this.handoverTo = null;
      this.digitalCounted = {};
      for (const d of this.summary?.digitalByProvider || []) this.digitalCounted[d.provider] = null;
      this.resetChecklist();
      this.loadSummary();
    });
  }

  resetChecklist() {
    this.checklist = this.closeType === "HANDOVER"
      ? freshChecklist(this.itemsFor("HANDOVER", HANDOVER_CHECKLIST_ITEMS))
      : freshChecklist(this.itemsFor("CLOSING", CLOSING_CHECKLIST_ITEMS));
  }

  get takers(): any[] { return this.staff.filter(u => u.id !== this.operatorId); }
  /** an item is ticked or unticked: the moment is kept with the shift */
  tick(c: ChecklistItem, value: boolean) {
    c.checked = !!value;
    c.at = c.checked ? new Date().toISOString() : undefined;
  }

  /** when each ticked item was ticked, by key */
  private tickTimes(): { [key: string]: string } {
    const out: { [key: string]: string } = {};
    this.checklist.forEach(c => { if (c.checked && c.at) out[c.key] = c.at; });
    return out;
  }

  /** every item on the list in force is ticked (a business may keep a list empty) */
  get checklistComplete(): boolean { return this.checklist.every(c => c.checked); }
  get expected(): number { return Number(this.summary?.expected ?? this.openShift?.expectedcash ?? 0); }
  get variance(): number { return this.denomTotal - this.expected; }
  digitalVariance(d: any): number | null {
    const v = this.digitalCounted[d.provider];
    return v === null || v === undefined || v === "" ? null : Number(v) - d.amount;
  }
  get digitalReady(): boolean { return (this.summary?.digitalByProvider || []).every((d: any) => this.digitalCounted[d.provider] !== null && this.digitalCounted[d.provider] !== undefined && this.digitalCounted[d.provider] !== ""); }

  confirmClose() {
    if (!this.openShift?.id || !this.requireOperator()) return;
    if (!this.denoms.length || this.denomTotal <= 0) { this.error = "Enter the drawer count before closing."; return; }
    if (this.closeType === "HANDOVER" && !this.handoverTo) { this.error = "Choose who is taking over."; return; }
    if (!this.digitalReady) { this.error = "Enter each digital total from the terminal."; return; }
    if (!this.checklistComplete) { this.error = "Complete the checklist before closing the shift."; return; }
    this.busy = true; this.error = "";
    const taker = this.staff.find(u => u.id === this.handoverTo)?.fullname;
    this.cash.closeShift(this.openShift.id, {
      counteddenominations: this.denoms, closedoperatorid: this.operatorId, closingchecklist: this.checklist.map(c => c.key), closingchecklistat: this.tickTimes(),
      closetype: this.closeType, handovertoid: this.closeType === "HANDOVER" ? this.handoverTo : undefined,
      closingdigital: (this.summary?.digitalByProvider || []).map((d: any) => ({ provider: d.provider, counted: Number(this.digitalCounted[d.provider]) })),
    }).subscribe({
      next: () => {
        this.busy = false; this.mode = "";
        this.message = this.closeType === "HANDOVER"
          ? `Handed over to ${taker}. Their shift is open with Rs ${Math.round(this.denomTotal).toLocaleString("en-IN")} in the drawer.`
          : "Shift closed.";
        this.shiftContext.reload();
      },
      error: err => { this.busy = false; this.error = err?.error?.message || "Unable to close the shift"; },
    });
  }

  cancel() { this.mode = ""; this.error = ""; }

  // ------------------------------------------------------------ expenses paid from the cash drawer
  addExpense() { this.expenseForm = { amount: null, expensecategory: "MISC", description: "" }; }

  saveExpense() {
    const f = this.expenseForm;
    if (!(Number(f.amount) > 0)) { this.error = "Enter the amount paid."; return; }
    if (!String(f.description || "").trim()) { this.error = "Say what it was for."; return; }
    this.error = "";
    this.cash.saveLedger({ storeid: this.storeId, shiftid: this.openShift.id, category: "EXPENSE", withdraw: Number(f.amount), expensecategory: f.expensecategory, description: f.description })
      .subscribe({
        next: () => { this.expenseForm = null; this.message = "Expense recorded."; this.shiftContext.reload(); this.loadSummary(); },
        error: err => this.error = err?.error?.message || "Unable to record the expense",
      });
  }

  /** what a recorded checklist is called on screen */
  checklistTitle(kind: string): string {
    return ({ OPENING: 'Opening the store', OPENING_OPEN_STORE: 'Taking up the shift (store already open)', CLOSING: 'Closing the store', HANDOVER: 'Handing over the shift' } as any)[kind] || kind;
  }

  private requireOperator(): boolean {
    if (!this.operatorId) { this.error = "Choose who is at the counter first (the \"At the counter\" box above)."; return false; }
    return true;
  }
}
