import { Component, OnInit } from "@angular/core";
import { saveAs } from "file-saver";
import { HrService } from "./hr.service";

/** Monthly payroll: work out, adjust, approve, pay stubs and the bank sheet. */
@Component({ selector: "app-hr-payroll", templateUrl: "./hr-payroll.component.html" })
export class HrPayrollComponent implements OnInit {
  period = "";
  run: any = null;
  runs: any[] = [];
  warnings: string[] = [];
  message = "";
  error = "";
  busy = false;

  edit: any = null;            // the line being edited
  stub: any = null;
  reopenReason = "";
  reopening = false;

  constructor(private hr: HrService) {}

  ngOnInit() {
    // salary for a month is worked out in the next one
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    this.period = d.toISOString().slice(0, 7);
    this.load();
  }

  load() {
    this.error = "";
    this.stub = null; this.edit = null;
    this.hr.get(`payroll/${this.period}`).subscribe(r => this.run = r || null, e => this.error = this.hr.msg(e));
    this.hr.get("payroll").subscribe(r => this.runs = r);
  }

  pick(p: string) { this.period = p; this.warnings = []; this.message = ""; this.load(); }

  generate() {
    this.busy = true; this.message = this.error = "";
    this.hr.post(`payroll/${this.period}/generate`).subscribe(r => {
      this.busy = false; this.run = r.run; this.warnings = r.warnings || [];
      this.message = this.run.status === "DRAFT" ? "Worked out. Review each line, then approve." : "";
      this.hr.get("payroll").subscribe(x => this.runs = x);
    }, e => { this.busy = false; this.error = this.hr.msg(e); });
  }

  approve() {
    this.message = this.error = "";
    this.hr.post(`payroll/${this.period}/approve`).subscribe(r => { this.run = r; this.message = "Approved and locked. Staff-credit recoveries are recorded."; this.hr.get("payroll").subscribe(x => this.runs = x); },
      e => this.error = this.hr.msg(e));
  }

  reopen() {
    this.message = this.error = "";
    this.hr.post(`payroll/${this.period}/reopen`, { reason: this.reopenReason }).subscribe(r => { this.run = r; this.reopening = false; this.reopenReason = ""; this.message = "Reopened as a draft; the recoveries it wrote were removed."; },
      e => this.error = this.hr.msg(e));
  }

  startEdit(l: any) { this.edit = { id: l.id, name: l.name, unpaid_days: l.unpaid_days, extra_deduction: l.extra_deduction, kpi_incentive: l.kpi_incentive, adjustment: l.adjustment, adjustment_note: l.adjustment_note || "", staff_credit_recovery: l.staff_credit_recovery, owed: l.credit_outstanding }; }

  saveEdit() {
    this.error = this.message = "";
    const { id, name, owed, ...body } = this.edit;
    this.hr.put(`payroll/lines/${id}`, body).subscribe(() => { this.edit = null; this.message = "Line updated."; this.load(); }, e => this.error = this.hr.msg(e));
  }

  showStub(l: any) { this.hr.get(`payroll/stub/${l.id}`).subscribe(s => this.stub = s, e => this.error = this.hr.msg(e)); }

  download() { this.hr.blob(`payroll/${this.period}/export`).subscribe(b => saveAs(b, `payroll-${this.period}.xlsx`), e => this.error = "Could not download."); }

  /** a clean page in a new window to print or save as PDF */
  print() {
    const s = this.stub;
    if (!s) return;
    const e = (v: any) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
    const n = (v: number) => (+v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const earn = (s.earnings || []).map((x: any) => `<tr><td>${e(x.name)}</td><td class="r">${n(x.full)}</td><td class="r">${n(x.paid)}</td></tr>`).join("");
    const ded: [string, number][] = [
      ...(s.deductions || []).map((x: any) => [x.name, x.amount] as [string, number]),
      ["Other deduction", s.extra_deduction], ["Staff credit recovered", s.staff_credit_recovery],
    ];
    const dedRows = ded.filter(d => +d[1] > 0).map(d => `<tr><td>${e(d[0])}</td><td class="r">${n(d[1])}</td></tr>`).join("");
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { this.error = "Allow pop-ups to print the stub."; return; }
    w.document.write(`<html><head><title>Pay stub ${e(s.name)} ${s.period}</title><style>
      body{font-family:Arial,sans-serif;font-size:13px;margin:24px;color:#222} h2{margin:0} .muted{color:#666} table{width:100%;border-collapse:collapse;margin:10px 0}
      td,th{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left} .r{text-align:right} .tot td{font-weight:bold;border-top:2px solid #222} .net{font-size:16px}
    </style></head><body>
      <h2>${e(s.business?.name)}</h2><div class="muted">${e(s.business?.address)}</div><hr>
      <h3>Pay stub for ${s.period}</h3>
      <table><tr><td>Name</td><td>${e(s.name)}</td><td>Code</td><td>${e(s.emp_code)}</td></tr>
      <tr><td>Designation</td><td>${e(s.designation)}</td><td>Joined</td><td>${s.join_date}</td></tr>
      <tr><td>Bank</td><td>${e(s.bank_name)} ${e(s.account_no)}</td><td>Days paid</td><td>${s.payable_days} of 30</td></tr></table>
      <table><tr><th>Earnings</th><th class="r">Full month</th><th class="r">Paid</th></tr>${earn}
        ${+s.kpi_incentive ? `<tr><td>Incentive</td><td></td><td class="r">${n(s.kpi_incentive)}</td></tr>` : ""}
        ${+s.adjustment ? `<tr><td>${e(s.adjustment_note || "Adjustment")}</td><td></td><td class="r">${n(s.adjustment)}</td></tr>` : ""}</table>
      <table><tr><th>Deductions</th><th class="r">Amount</th></tr>${dedRows || '<tr><td colspan="2" class="muted">None</td></tr>'}</table>
      <table><tr class="tot net"><td>Net pay</td><td class="r">${n(s.net)}</td></tr></table>
      <p class="muted">Computer generated; no signature needed.</p></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  label(p: string) { return p; }
}
