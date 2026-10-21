import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

/**
 * Staff credit (Business Head): the monthly limit per person, what they took on credit, what was recovered from salary
 * and what is still to recover. Salary is worked out in Excel, so the month's figures can be downloaded for that sheet
 * and each recovery is recorded here once it has been deducted.
 */
@Component({
  selector: "app-staff-credit",
  templateUrl: "./staff-credit.component.html"
})
export class StaffCreditComponent implements OnInit {
  private readonly api = `${environment.apiHost}/staff-credit`;

  period = new Date().toISOString().slice(0, 7);
  rows: any[] = [];
  loading = false;
  message = "";
  error = "";

  capEdit: { [id: number]: any } = {};
  openId: number | null = null;          // whose entries are shown
  entries: any[] = [];
  mode: "recover" | "adjust" | "" = "";
  form: any = { amount: null, note: "" };

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.error = "";
    this.http.get<any[]>(`${this.api}/summary`, { params: { period: this.period } }).subscribe(
      r => { this.rows = r || []; this.loading = false; for (const x of this.rows) this.capEdit[x.user_id] = x.cap; },
      err => { this.loading = false; this.error = this.msg(err, "Could not load staff credit."); });
  }

  get totalOutstanding(): number { return this.rows.reduce((t, r) => t + (+r.outstanding || 0), 0); }
  get totalMonth(): number { return this.rows.reduce((t, r) => t + (+r.credit_month || 0), 0); }

  saveCap(r: any) {
    this.message = this.error = "";
    this.http.put(`${this.api}/${r.user_id}/cap`, { cap: this.capEdit[r.user_id] }).subscribe(
      () => { this.message = `${r.name}: monthly limit saved.`; this.load(); },
      err => this.error = this.msg(err, "Could not save the limit."));
  }

  show(r: any) {
    this.openId = this.openId === r.user_id ? null : r.user_id;
    this.mode = "";
    if (this.openId) this.http.get<any>(`${this.api}/${r.user_id}/entries`).subscribe(d => this.entries = d.rows || [], () => this.entries = []);
  }

  startMode(m: "recover" | "adjust", r: any) {
    this.openId = r.user_id;
    this.mode = m;
    this.form = { amount: m === "recover" ? r.outstanding : null, note: "" };
    this.http.get<any>(`${this.api}/${r.user_id}/entries`).subscribe(d => this.entries = d.rows || [], () => this.entries = []);
  }

  save(r: any) {
    this.message = this.error = "";
    const path = this.mode === "recover" ? "recovery" : "adjustment";
    const body: any = { amount: this.form.amount, note: this.form.note, period: this.period };
    this.http.post(`${this.api}/${r.user_id}/${path}`, body).subscribe(
      () => {
        this.message = this.mode === "recover" ? `${r.name}: recovery recorded.` : `${r.name}: adjustment recorded.`;
        this.mode = "";
        this.load();
        this.http.get<any>(`${this.api}/${r.user_id}/entries`).subscribe(d => this.entries = d.rows || []);
      },
      err => this.error = this.msg(err, "Could not save."));
  }

  /** the month as a CSV for the salary sheet */
  download() {
    const head = ["Name", "Email", "Role", "Monthly limit", `Credit taken ${this.period}`, `Recovered ${this.period}`, "Outstanding"];
    const lines = this.rows.filter(r => r.credit_month || r.recovered_month || r.outstanding || r.cap)
      .map(r => [r.name, r.email, r.role || "", r.cap, r.credit_month, r.recovered_month, r.outstanding]);
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `staff-credit-${this.period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  kindLabel(k: string) { return k === "CREDIT" ? "Credit (bill)" : k === "RECOVERY" ? "Recovered from salary" : "Adjustment"; }

  private msg(err: any, fallback: string): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : (m || fallback);
  }
}
