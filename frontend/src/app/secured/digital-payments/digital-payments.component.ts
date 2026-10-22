import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

/** Digital payments checked by hand against the Paytm / card machine statement, bill by bill. */
@Component({ selector: "app-digital-payments", templateUrl: "./digital-payments.component.html" })
export class DigitalPaymentsComponent implements OnInit {
  private readonly api = `${environment.apiHost}/payment-recon`;

  from = this.iso(new Date(Date.now() - 6 * 86400000));
  to = this.iso(new Date());
  method = "";
  state = "PENDING";
  text = "";

  data: any = { summary: { bills: 0, amount: 0, pending: {}, suggested: {}, sure: {}, verified: {}, mismatch: {}, not_found: {}, unbilled: {} }, days: [], rows: [], unbilled: [] };

  // the statement upload (Business Head)
  statements: any[] = [];
  file: File | null = null;
  preview: any = null;
  showUpload = false;
  selected = new Set<number>();
  /** the bill being marked as differing or missing, with what the statement shows */
  editing: { id: number; status: "MISMATCH" | "NOT_FOUND"; amount_seen: number | null; note: string } | null = null;
  message = "";
  error = "";
  busy = false;

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); this.loadStatements(); }

  loadStatements() { this.http.get<any[]>(`${this.api}/statements`).subscribe(r => this.statements = r, () => this.statements = []); }

  pick(ev: Event) {
    this.file = (ev.target as HTMLInputElement).files?.[0] || null;
    this.preview = null; this.error = ""; this.message = "";
    if (this.file) this.send("statements/preview", r => this.preview = r);
  }

  private send(path: string, ok: (r: any) => void) {
    const f = new FormData(); f.append("file", this.file as File);
    this.busy = true;
    this.http.post<any>(`${this.api}/${path}`, f).subscribe(r => { this.busy = false; ok(r); }, e => { this.busy = false; this.error = this.msg(e); });
  }

  saveStatement() {
    if (!this.file || !this.preview) return;
    this.send("statements", r => {
      this.message = `${r.kept} payment${r.kept === 1 ? "" : "s"} saved from the statement (${r.from} to ${r.to})${r.duplicates ? `; ${r.duplicates} were already there` : ""}.`;
      this.file = null; this.preview = null; this.showUpload = false;
      this.from = r.from; this.to = r.to; this.state = "SUGGESTED";
      this.load(); this.loadStatements();
    });
  }

  removeStatement(s: any) {
    this.http.delete(`${this.api}/statements/${s.id}`).subscribe(() => { this.message = `Statement ${s.file_name} removed.`; this.load(); this.loadStatements(); }, e => this.error = this.msg(e));
  }

  acceptAll(level: "SURE" | "ALL") {
    this.message = ""; this.busy = true;
    const body: any = { from: this.from, to: this.to, level };
    if (this.method) body.method = this.method;
    this.http.post<any>(`${this.api}/accept`, body).subscribe(r => this.done(`${r.verified} bill${r.verified === 1 ? "" : "s"} verified from the statement.`), e => this.failed(e));
  }

  accept(r: any) {
    this.message = ""; this.busy = true;
    this.http.post(`${this.api}/${r.id}`, { status: "VERIFIED", txn_pk: r.suggestion.txn_pk }).subscribe(() => this.done(`Bill ${r.bill_no || r.id} verified.`), e => this.failed(e));
  }

  tail(id: string) { return String(id || "").slice(-4); }

  private iso(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

  msg(err: any, fallback = "Something went wrong."): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }

  load() {
    this.error = "";
    const params: any = { from: this.from, to: this.to, state: this.state };
    if (this.method) params.method = this.method;
    if (this.text.trim()) params.q = this.text.trim();
    this.http.get<any>(this.api, { params }).subscribe(r => { this.data = r; this.selected.clear(); }, e => this.error = this.msg(e));
  }

  setState(s: string) { this.state = s; this.editing = null; this.load(); }

  showDay(d: string) { this.from = d; this.to = d; this.load(); }

  toggle(id: number) { this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id); }

  get pendingRows(): any[] { return this.data.rows.filter((r: any) => !r.check_status); }
  get allSelected() { return this.pendingRows.length > 0 && this.pendingRows.every((r: any) => this.selected.has(r.id)); }
  toggleAll() { const all = this.allSelected; this.selected.clear(); if (!all) this.pendingRows.forEach((r: any) => this.selected.add(r.id)); }
  get selectedTotal() { return this.data.rows.filter((r: any) => this.selected.has(r.id)).reduce((t: number, r: any) => t + r.amount, 0); }

  private done(text: string) { this.message = text; this.busy = false; this.editing = null; this.load(); }
  private failed(e: any) { this.error = this.msg(e); this.busy = false; }

  verify(r: any) {
    this.message = ""; this.busy = true;
    this.http.post(`${this.api}/${r.id}`, { status: "VERIFIED" }).subscribe(() => this.done(`Bill ${r.bill_no || r.id} verified.`), e => this.failed(e));
  }

  verifySelected() {
    if (!this.selected.size) return;
    this.message = ""; this.busy = true;
    this.http.post<any>(`${this.api}/verify-many`, { sale_ids: Array.from(this.selected) })
      .subscribe(r => this.done(`${r.verified} bill${r.verified === 1 ? "" : "s"} verified.`), e => this.failed(e));
  }

  startFlag(r: any, status: "MISMATCH" | "NOT_FOUND") {
    this.message = ""; this.error = "";
    this.editing = { id: r.id, status, amount_seen: status === "MISMATCH" ? (r.amount_seen ?? null) : null, note: r.note || "" };
  }

  saveFlag() {
    if (!this.editing) return;
    this.busy = true;
    const e = this.editing;
    this.http.post(`${this.api}/${e.id}`, { status: e.status, amount_seen: e.amount_seen, note: e.note })
      .subscribe(() => this.done("Saved."), err => this.failed(err));
  }

  undo(r: any) {
    this.message = ""; this.busy = true;
    this.http.delete(`${this.api}/${r.id}`).subscribe(() => this.done(`Bill ${r.bill_no || r.id} is back to be checked.`), e => this.failed(e));
  }

  label(s: string) { return s === "VERIFIED" ? "Verified" : s === "MISMATCH" ? "Amount differs" : s === "NOT_FOUND" ? "Not on statement" : "To check"; }
  badge(s: string) { return s === "VERIFIED" ? "bg-success" : s === "MISMATCH" ? "bg-warning text-dark" : s === "NOT_FOUND" ? "bg-danger" : "bg-secondary"; }
}
