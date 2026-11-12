import { Component, OnInit } from "@angular/core";
import { FileUploadService } from "../documents/file-upload.service";
import { ExpenseApi } from "./expense.service";
import { offered } from "./expense-category-kinds";

/** The ledger: raise an expense, see them, approve or reject the ones waiting for you. */
@Component({ selector: "app-expense-list", templateUrl: "./expense-list.component.html" })
export class ExpenseListComponent implements OnInit {
  rows: any[] = [];
  categories: any[] = [];

  /** only the categories that fit where the expense is paid: a store's, or business level */
  get categoryChoices(): any[] { return offered(this.categories, this.form?.store_id ?? null); }
  /** a category that does not fit the new store is dropped, so it is chosen again */
  storeChanged() {
    if (this.form?.category_id && !this.categoryChoices.some((c: any) => c.id === this.form.category_id)) this.form.category_id = null;
    this.loadPayChoices();
  }

  /** the open shifts whose drawer can pay a cash expense, and the bank accounts a non-cash one can be paid from (for the store chosen) */
  openShifts: any[] = [];
  bankAccounts: any[] = [];

  /** what "paid by" asks next: cash says where the cash came from; anything else says which account it left and under what reference */
  payChanged() {
    if (!this.form) return;
    this.loadPayChoices();
  }

  private loadPayChoices() {
    const f = this.form;
    this.openShifts = []; this.bankAccounts = [];
    if (!f) return;
    if (f.pay_mode === "CASH") {
      f.bank_account_id = null; f.reference = "";
      if (!f.store_id) { f.cash_source = "OUTSIDE"; f.shift_id = null; return; }
      const store = f.store_id;
      this.api.get("open-shifts", { store }).subscribe((r: any[]) => {
        if (this.form?.store_id !== store || this.form?.pay_mode !== "CASH") return;
        this.openShifts = r || [];
        // the drawer of the open shift is the usual source: it is chosen unless the person says otherwise or there is no open shift
        if (this.form.cash_source !== "OUTSIDE" || !this.form.id) {
          const keep = this.openShifts.find((s: any) => s.id === this.form.shift_id);
          this.form.shift_id = keep ? keep.id : (this.openShifts[0]?.id ?? null);
          this.form.cash_source = this.form.shift_id ? "DRAWER" : "OUTSIDE";
        }
      }, () => { this.openShifts = []; this.form.cash_source = "OUTSIDE"; this.form.shift_id = null; });
    } else {
      f.cash_source = null; f.shift_id = null;
      this.api.get("bank-accounts", f.store_id ? { store: f.store_id } : {}).subscribe((r: any[]) => {
        if (!this.form || this.form.pay_mode === "CASH") return;
        this.bankAccounts = r || [];
        if (!this.bankAccounts.some((a: any) => a.id === this.form.bank_account_id)) this.form.bank_account_id = this.bankAccounts.length === 1 ? this.bankAccounts[0].id : null;
      }, () => this.bankAccounts = []);
    }
  }

  setCashSource(src: string) {
    if (!this.form) return;
    this.form.cash_source = src;
    if (src === "DRAWER" && !this.form.shift_id) this.form.shift_id = this.openShifts[0]?.id ?? null;
  }

  /** the lines the bank has not shown for a week or more: paid by bank, UPI, card or cheque, approved, and not matched to a statement line */
  onlyUnmatched = false;
  get shownRows(): any[] {
    if (!this.onlyUnmatched) return this.rows;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return this.rows.filter((r: any) => r.bankable && !r.bank_matched && r.expense_date <= weekAgo);
  }
  stores: any[] = [];
  role = "";
  limit = 0;
  pendingForMe = 0;
  message = "";
  error = "";

  filter: any = { period: "", status: "", store: "", category: "" };
  form: any = null;
  deciding: { id: number; note: string } | null = null;
  readonly modes = [["CASH", "Cash"], ["BANK", "Bank transfer"], ["UPI", "UPI"], ["CARD", "Card"], ["CHEQUE", "Cheque"]];

  constructor(private api: ExpenseApi, private files: FileUploadService) {}

  ngOnInit() {
    this.filter.period = this.api.thisMonth();
    this.api.get("policy").subscribe(p => { this.role = p.role; this.limit = p.limit; this.stores = p.stores; });
    this.api.get("categories").subscribe(c => this.categories = c.filter((x: any) => x.active));
    this.load();
  }

  load() {
    const params: any = {};
    for (const k of Object.keys(this.filter)) if (this.filter[k]) params[k] = this.filter[k];
    this.api.get("", params).subscribe(r => { this.rows = r.rows; this.pendingForMe = r.pending_for_me; }, e => this.error = this.api.msg(e));
  }

  get isBusinessHead() { return this.role === "Business Head"; }

  add() {
    this.message = this.error = "";
    this.form = { id: 0, expense_date: this.api.today(), store_id: this.stores.length === 1 ? this.stores[0].id : null, category_id: null, amount: null, gst_amount: 0, payee: "", bill_no: "", pay_mode: "CASH", cash_source: "OUTSIDE", shift_id: null, bank_account_id: null, reference: "", description: "", receipt_path: "" };
    this.loadPayChoices();
  }

  edit(r: any) {
    this.message = this.error = "";
    this.form = { ...r, cash_source: r.cash_source || (r.pay_mode === "CASH" ? "OUTSIDE" : null), reference: r.reference || "" };
    this.loadPayChoices();
  }

  willNeedApproval(): string {
    const f = this.form;
    if (!f || !(+f.amount > 0)) return "";
    if (this.isBusinessHead) return "Raised by you, so it is approved straight away.";
    if (this.role === "Store Head") return +f.amount <= this.limit ? "Within your store limit, so it is approved straight away." : `Above the store limit of ${this.limit}: the Business Head will approve it.`;
    return "The Store Head will approve it.";
  }

  save() {
    this.message = this.error = "";
    const body = { ...this.form };
    if (body.pay_mode !== "CASH" && body.pay_mode !== "UPI" && this.bankAccounts.length && !body.bank_account_id) { this.error = "Choose the bank account it was paid from."; return; }
    const call = body.id ? this.api.put(`${body.id}`, body) : this.api.post("", body);
    call.subscribe((r: any) => {
      this.message = body.id ? "Expense updated." : (r.status === "APPROVED" ? "Expense recorded and approved." : "Expense recorded, waiting for approval.");
      this.form = null; this.load();
    }, e => this.error = this.api.msg(e));
  }

  remove(r: any) {
    this.api.delete(`${r.id}`).subscribe(() => { this.message = "Removed."; this.load(); }, e => this.error = this.api.msg(e));
  }

  decide(r: any, action: string) {
    this.message = this.error = "";
    if (action === "reject" && !this.deciding) { this.deciding = { id: r.id, note: "" }; return; }
    this.api.post(`${r.id}/decision`, { action, note: this.deciding?.note }).subscribe(() => { this.deciding = null; this.message = action === "approve" ? "Approved." : "Rejected."; this.load(); }, e => this.error = this.api.msg(e));
  }

  upload(event: any) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    this.files.upload(file, `expense=${this.form.store_id || "biz"}-${Date.now()}`).subscribe((res: any) => this.form.receipt_path = res?.path || "", () => this.error = "Could not upload the receipt.");
  }

  viewReceipt(path: string) {
    this.files.view(path).subscribe((b: any) => window.open(URL.createObjectURL(b), "_blank"), () => this.error = "Could not open the receipt.");
  }

  badge(s: string) { return s === "APPROVED" ? "bg-success" : s === "PENDING" ? "bg-warning text-dark" : "bg-secondary"; }
  mode(m: string) { return (this.modes.find(x => x[0] === m) || [m, m])[1]; }
}
