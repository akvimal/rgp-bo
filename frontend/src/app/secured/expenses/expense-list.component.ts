import { Component, OnInit } from "@angular/core";
import { FileUploadService } from "../documents/file-upload.service";
import { ExpenseApi } from "./expense.service";

/** The ledger: raise an expense, see them, approve or reject the ones waiting for you. */
@Component({ selector: "app-expense-list", templateUrl: "./expense-list.component.html" })
export class ExpenseListComponent implements OnInit {
  rows: any[] = [];
  categories: any[] = [];
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
    this.form = { id: 0, expense_date: this.api.today(), store_id: this.stores.length === 1 ? this.stores[0].id : null, category_id: null, amount: null, gst_amount: 0, payee: "", bill_no: "", pay_mode: "BANK", description: "", receipt_path: "" };
  }

  edit(r: any) {
    this.message = this.error = "";
    this.form = { ...r };
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
