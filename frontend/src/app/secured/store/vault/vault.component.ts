import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { UsersService } from "../../settings/users/users.service";
import { DenominationRow } from "src/app/shared/denominations";
import { VaultService } from "./vault.service";
import { CashService } from "../cash/cash.service";

type Panel = "" | "opening" | "deposit" | "change" | "count" | "adjust" | "dropnow";

const TYPE_LABEL: { [t: string]: string } = {
  OPENING: "Opening balance", DROP_IN: "Put in from a shift", BANK_DEPOSIT_OUT: "Banked", CHANGE_TO_DRAWER: "Change to a drawer", ADJUSTMENT: "Adjustment",
};

/**
 * The store vault: what is in it by note and coin, what waits for a second person, and the actions that move cash in and out. The API
 * decides who may do what; this screen shows the result and the reason when something is refused.
 */
@Component({ templateUrl: "./vault.component.html" })
export class VaultComponent implements OnInit, OnDestroy {
  private subs = new Subscription();

  storeId: number | null = null;
  state: any = null;
  history: any[] = [];
  loading = false;
  error = "";
  message = "";
  busy = false;

  me: any = null;

  panel: Panel = "";
  rows: DenominationRow[] = [];
  total = 0;
  referenceno = "";
  transdate = new Date().toISOString().slice(0, 10);
  notes = "";
  direction: "IN" | "OUT" = "OUT";
  reason = "";
  countResult: any = null;

  rejecting: any = null;
  rejectReason = "";

  filterType = "";

  /** the open shifts whose drawer cash can go into the vault now */
  openShifts: any[] = [];
  dropShiftId: any = "";

  constructor(private storeContext: StoreContextService, private vault: VaultService, private users: UsersService, private cash: CashService) {}

  ngOnInit(): void {
    this.users.getCurrentUser().subscribe((u: any) => this.me = u, () => this.me = null);
    const pick = () => {
      const id = this.storeContext.effectiveStoreId();
      if (id === this.storeId && this.state) return;
      this.storeId = id;
      this.closePanel();
      this.reload();
    };
    this.subs.add(this.storeContext.selectedStoreId$.subscribe(pick));
    this.subs.add(this.storeContext.stores$.subscribe(pick));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  get isOwner(): boolean { return this.me?.rolename === "Business Head" || this.me?.rolename === "Owner-operator"; }
  label(t: string): string { return TYPE_LABEL[t] || t; }
  get noMovements(): boolean { return this.history.length === 0 && !this.state?.pending?.length; }
  mine(m: any): boolean { return !!this.me && Number(m.actorid) === Number(this.me.id); }

  /** `keep`: refresh in place after an action, so the page does not blank out while it loads */
  reload(keep = false) {
    this.error = "";
    if (!keep) { this.state = null; this.history = []; }
    if (!this.storeId) return;
    this.loading = true;
    this.vault.state(this.storeId).subscribe({
      next: (s: any) => { this.state = s; this.loading = false; this.loadHistory(); },
      error: err => { this.loading = false; this.error = err?.error?.message || "Unable to load the vault"; },
    });
  }

  loadHistory() {
    if (!this.storeId) return;
    this.vault.movements(this.storeId, { type: this.filterType, limit: 100 }).subscribe({
      next: (rows: any) => this.history = rows || [],
      error: () => this.history = [],
    });
  }

  // ------------------------------------------------------------ actions
  open(p: Panel) {
    this.message = this.error = ""; this.countResult = null;
    if (p === "dropnow") {
      this.openShifts = []; this.dropShiftId = "";
      this.cash.getShifts(this.storeId).subscribe((s: any) => {
        this.openShifts = (s || []).filter((x: any) => x.status === "OPEN");
        if (this.openShifts.length === 1) this.dropShiftId = this.openShifts[0].id;
      }, () => this.openShifts = []);
    }
    this.panel = p; this.rows = []; this.total = 0; this.referenceno = ""; this.notes = ""; this.reason = ""; this.direction = "OUT";
    this.transdate = new Date().toISOString().slice(0, 10);
  }
  closePanel() { this.panel = ""; this.rows = []; this.total = 0; }

  get canSubmit(): boolean {
    if (this.busy) return false;
    if (this.panel === "count") return true;               // an empty vault can be counted
    if (this.total <= 0) return false;
    if (this.panel === "dropnow") return !!this.dropShiftId;
    if (this.panel === "adjust") return this.reason.trim().length > 0;
    return true;
  }

  submit() {
    if (!this.storeId || !this.canSubmit) return;
    this.busy = true; this.error = this.message = "";
    const id = this.storeId;
    const done = (text: string, keepPanel = false) => (res: any) => {
      this.busy = false; this.message = text;
      if (this.panel === "count") this.countResult = res;
      if (!keepPanel) this.closePanel();
      this.reload(true);
    };
    const fail = (err: any) => { this.busy = false; this.error = err?.error?.message || "That did not go through"; };
    const notes = this.notes.trim() || undefined;
    switch (this.panel) {
      case "opening": this.vault.opening(id, this.rows, notes).subscribe({ next: done("Opening balance recorded."), error: fail }); break;
      case "deposit": this.vault.deposit(id, { denominations: this.rows, referenceno: this.referenceno.trim() || undefined, transdate: this.transdate || undefined, notes }).subscribe({
        next: (res: any) => done(res?.status === "PENDING" ? "Deposit recorded. A second person must confirm it before it counts." : "Deposit recorded in the cash book.")(res), error: fail }); break;
      case "dropnow": this.vault.dropNow(id, Number(this.dropShiftId), this.rows, notes).subscribe({
        next: (res: any) => done(res?.status === "PENDING" ? "Put in the vault. A second person must confirm it before it counts in the vault." : "Put in the vault. The drawer's expected cash is lower by the same amount.")(res), error: fail }); break;
      case "change": this.vault.change(id, this.rows, notes).subscribe({ next: done("Change given from the vault."), error: fail }); break;
      case "count": this.vault.count(id, this.rows, notes).subscribe({ next: done("Count recorded.", true), error: fail }); break;
      case "adjust": this.vault.adjust(id, { direction: this.direction, denominations: this.rows, reason: this.reason.trim(), notes }).subscribe({ next: done("Adjustment recorded."), error: fail }); break;
    }
  }

  confirm(m: any) {
    this.busy = true; this.error = this.message = "";
    this.vault.confirm(m.id).subscribe({
      next: () => { this.busy = false; this.message = "Confirmed."; this.reload(true); },
      error: err => { this.busy = false; this.error = err?.error?.message || "Unable to confirm"; },
    });
  }

  startReject(m: any) { this.rejecting = m; this.rejectReason = ""; }
  cancelReject() { this.rejecting = null; }
  sendReject() {
    if (!this.rejecting || !this.rejectReason.trim()) return;
    this.busy = true; this.error = this.message = "";
    this.vault.reject(this.rejecting.id, this.rejectReason.trim()).subscribe({
      next: () => { this.busy = false; this.rejecting = null; this.message = "Done."; this.reload(true); },
      error: err => { this.busy = false; this.error = err?.error?.message || "Unable to do that"; },
    });
  }

  /** "3 x 500, 20 x 100" */
  words(rows: DenominationRow[] | null | undefined): string {
    return (rows || []).map(r => `${r.n} x ${r.d}`).join(", ");
  }
}
