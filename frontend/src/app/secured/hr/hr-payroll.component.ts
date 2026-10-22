import { Component, OnInit } from "@angular/core";
import { saveAs } from "file-saver";
import { HrService } from "./hr.service";
import { printPayslip } from "./payslip-print";

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
    if (!this.stub) return;
    if (!printPayslip(this.stub)) this.error = "Allow pop-ups to print the stub.";
  }

  label(p: string) { return p; }
}
