import { Component, OnInit } from "@angular/core";
import { VendorIssueApi } from "./vendor-issue.service";

/** Vendor grievances: invoice corrections and defective goods, from raising them to the vendor settling. */
@Component({ selector: "app-vendor-issues", templateUrl: "./vendor-issues.component.html" })
export class VendorIssuesComponent implements OnInit {
  rows: any[] = [];
  summary: any = { open: 0, with_vendor: 0, overdue: 0, claimed_open: 0, recovered_this_month: 0 };
  opts: any = { vendors: [], stores: [], kinds: [], fields: [], vias: [], resolutions: [], canManage: false };
  scorecard: any[] = [];
  tab: "ACTIVE" | "OVERDUE" | "SETTLED" | "ALL" | "SCORECARD" = "ACTIVE";
  vendorFilter: number | null = null;
  search = "";
  message = "";
  error = "";

  /** the issue open on screen */
  issue: any = null;
  /** the form for a new issue */
  form: any = null;
  invoices: any[] = [];
  invoiceItems: any[] = [];

  sending: any = null;     // { via, vendor_ref, due_on }
  resolving: any = null;   // { resolution, credit_amount, credit_ref, note }
  rejecting: any = null;   // { note }
  noteText = "";

  readonly kindLabels: { [k: string]: string } = { INVOICE_FIX: "Invoice correction", DEFECTIVE: "Defective / damaged goods", SHORT_SUPPLY: "Short supply", WRONG_ITEM: "Wrong item sent", OTHER: "Other" };
  readonly statusLabels: { [k: string]: string } = { OPEN: "Not sent yet", WITH_VENDOR: "With the vendor", RESOLVED: "Settled", REJECTED: "Refused by the vendor", CANCELLED: "Cancelled" };
  readonly fieldLabels: { [k: string]: string } = { RATE: "Rate", QTY: "Quantity", TAX: "Tax %", MRP: "MRP", EXPIRY: "Expiry", BATCH: "Batch", OTHER: "Other" };
  readonly resLabels: { [k: string]: string } = { CREDIT_NOTE: "Credit note", REFUND: "Refund", REPLACEMENT: "Replacement goods", CORRECTED_INVOICE: "Corrected invoice" };

  constructor(public api: VendorIssueApi) {}

  ngOnInit() {
    this.api.get("options").subscribe(o => this.opts = o);
    this.load();
  }

  load() {
    this.error = "";
    if (this.tab === "SCORECARD") { this.api.get("scorecard").subscribe(r => this.scorecard = r, e => this.error = this.api.msg(e)); return; }
    const q: any = {};
    if (this.tab === "ACTIVE") q.status = "ACTIVE";
    if (this.tab === "OVERDUE") { q.status = "ACTIVE"; q.overdue = "true"; }
    if (this.tab === "SETTLED") q.status = "RESOLVED";
    if (this.tab === "ALL") q.status = "ALL";
    if (this.vendorFilter) q.vendor_id = this.vendorFilter;
    if (this.search.trim()) q.q = this.search.trim();
    this.api.get("", q).subscribe(r => this.rows = r, e => this.error = this.api.msg(e));
    this.api.get("summary").subscribe(s => this.summary = s);
  }

  setTab(t: any) { this.tab = t; this.issue = null; this.form = null; this.load(); }

  // ------------------------------------------------------------ raising
  add() {
    this.message = this.error = "";
    this.issue = null;
    this.invoices = []; this.invoiceItems = [];
    this.form = { vendor_id: null, invoice_id: null, store_id: this.opts.stores.length === 1 ? this.opts.stores[0].id : null, kind: "DEFECTIVE", summary: "", details: "", claimed_amount: null, lines: [] };
  }

  vendorChanged() {
    this.form.invoice_id = null; this.form.lines = []; this.invoiceItems = [];
    this.invoices = [];
    if (this.form.vendor_id) this.api.get("invoices", { vendor_id: this.form.vendor_id }).subscribe(r => this.invoices = r);
  }

  invoiceChanged() {
    this.form.lines = []; this.invoiceItems = [];
    if (this.form.invoice_id) this.loadInvoiceItems();
  }

  loadInvoiceItems() {
    const p: any = { invoice_id: this.form.invoice_id };
    if (this.form.store_id) p.store_id = this.form.store_id;
    this.api.get("invoice-items", p).subscribe(r => this.invoiceItems = r);
  }

  kindChanged() { this.form.lines = []; }

  get goodsKind(): boolean { return this.form && ["DEFECTIVE", "WRONG_ITEM"].includes(this.form.kind); }

  /** add a batch from the invoice as a line */
  addItemLine(it: any) {
    if (this.form.lines.some((l: any) => l.purchase_item_id === it.id)) return;
    this.form.lines = [...this.form.lines, { purchase_item_id: it.id, description: `${it.title} (${it.batch || "-"})`, qty: this.goodsKind ? 1 : null, unit_cost: it.ptr_cost, amount: this.goodsKind ? it.ptr_cost : null, field: this.form.kind === "INVOICE_FIX" ? "RATE" : null, billed_value: "", correct_value: "", max: it.available }];
  }

  addFreeLine() { this.form.lines = [...this.form.lines, { purchase_item_id: null, description: "", qty: null, unit_cost: null, amount: null, field: this.form.kind === "INVOICE_FIX" ? "OTHER" : null, billed_value: "", correct_value: "" }]; }
  removeLine(i: number) { this.form.lines = this.form.lines.filter((_: any, k: number) => k !== i); }

  lineChanged(l: any) {
    if (this.goodsKind && l.qty && l.unit_cost !== null && l.unit_cost !== "") l.amount = Math.round(l.qty * l.unit_cost * 100) / 100;
  }

  get formTotal(): number { return (this.form?.lines || []).reduce((t: number, l: any) => t + (Number(l.amount) || 0), 0); }

  saveForm() {
    this.error = this.message = "";
    const f = this.form;
    const body: any = { vendor_id: f.vendor_id, invoice_id: f.invoice_id, store_id: f.store_id, kind: f.kind, summary: f.summary, details: f.details, lines: f.lines.map((l: any) => ({ ...l, max: undefined })) };
    if (!f.lines.length && f.claimed_amount) body.claimed_amount = f.claimed_amount;
    this.api.post("", body).subscribe(r => { this.message = "Issue raised."; this.form = null; this.open(r.id); this.load(); }, e => this.error = this.api.msg(e));
  }

  // ------------------------------------------------------------ one issue
  open(id: number) {
    this.sending = this.resolving = this.rejecting = null; this.noteText = "";
    this.api.get(String(id)).subscribe(i => { this.issue = i; this.form = null; }, e => this.error = this.api.msg(e));
  }

  close() { this.issue = null; this.load(); }

  private act(path: string, body: any, ok: string) {
    this.error = this.message = "";
    this.api.post(`${this.issue.id}/${path}`, body).subscribe(r => {
      this.message = typeof ok === "string" ? ok.replace("{moved}", r?.moved ?? "") : "Done.";
      this.sending = this.resolving = this.rejecting = null;
      this.open(this.issue.id);
    }, e => this.error = this.api.msg(e));
  }

  startSend() { this.sending = { via: "PHONE", vendor_ref: "", due_on: "" }; this.resolving = this.rejecting = null; }
  confirmSend() { this.act("send", this.sending, "Marked as sent to the vendor."); }
  sendBack() { this.act("return", {}, "{moved} units taken out of stock and sent back."); }
  startResolve() { this.resolving = { resolution: "CREDIT_NOTE", credit_amount: this.issue.claimed || null, credit_ref: "", note: "" }; this.sending = this.rejecting = null; }
  confirmResolve() { this.act("resolve", this.resolving, "Settled."); }
  startReject() { this.rejecting = { note: "" }; this.sending = this.resolving = null; }
  confirmReject() { this.act("reject", this.rejecting, "Recorded as refused."); }
  cancel() { this.act("cancel", {}, "Cancelled."); }
  reopen() { this.act("reopen", {}, "Reopened."); }
  addNote() { if (!this.noteText.trim()) return; this.api.post(`${this.issue.id}/notes`, { note: this.noteText }).subscribe(() => { this.noteText = ""; this.open(this.issue.id); }, e => this.error = this.api.msg(e)); }

  get goodsToReturn(): boolean {
    return !!this.issue && ["DEFECTIVE", "WRONG_ITEM"].includes(this.issue.kind) && ["OPEN", "WITH_VENDOR"].includes(this.issue.status)
      && (this.issue.lines || []).some((l: any) => l.purchase_item_id && l.qty > 0 && !l.returned_qty);
  }
}
