import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/** Staff list, profile and salary revisions. */
@Component({ selector: "app-hr-staff", templateUrl: "./hr-staff.component.html" })
export class HrStaffComponent implements OnInit {
  rows: any[] = [];
  candidates: any[] = [];
  stores: any[] = [];
  components: any[] = [];
  message = "";
  error = "";

  /** null = the list; otherwise the person being edited (id 0 = a new one) */
  editing: any = null;
  detail: any = null;
  exitDate = "";

  revising = false;
  rev: any = { effective_from: "", reason: "", amounts: {} };

  constructor(private hr: HrService) {}

  ngOnInit() { this.load(); }

  load() {
    this.hr.get("staff").subscribe(r => this.rows = r, e => this.error = this.hr.msg(e));
    this.hr.get("staff/candidates").subscribe(r => this.candidates = r);
    this.hr.get("stores").subscribe(r => this.stores = r);
    this.hr.get("components").subscribe(r => this.components = (r || []).filter((c: any) => c.active));
  }

  add() {
    this.message = this.error = "";
    this.detail = null;
    this.editing = { id: 0, user_id: null, emp_code: "", designation: "", store_id: null, emp_type: "FULL_TIME", join_date: this.hr.today(), weekly_off: "SUNDAY" };
  }

  open(r: any) {
    this.message = this.error = "";
    this.hr.get(`staff/${r.id}`).subscribe(d => {
      this.detail = d;
      this.editing = { ...d, join_date: String(d.join_date).slice(0, 10), dob: d.dob ? String(d.dob).slice(0, 10) : "" };
      this.revising = false;
      this.exitDate = this.hr.today();
    }, e => this.error = this.hr.msg(e));
  }

  back() { this.editing = null; this.detail = null; this.load(); }

  save() {
    this.message = this.error = "";
    const e = this.editing;
    const body: any = {
      emp_code: e.emp_code, designation: e.designation, store_id: e.store_id, emp_type: e.emp_type, join_date: e.join_date, weekly_off: e.weekly_off,
      dob: e.dob || null, address: e.address, emergency_name: e.emergency_name, emergency_phone: e.emergency_phone,
      pan: e.pan, aadhaar_last4: e.aadhaar_last4, bank_name: e.bank_name, account_no: e.account_no, ifsc: e.ifsc, notes: e.notes,
    };
    if (!e.id) {
      body.user_id = e.user_id;
      this.hr.post("staff", body).subscribe(r => { this.message = `Staff record added (${r.emp_code}). Now set their salary.`; this.open({ id: r.id }); }, err => this.error = this.hr.msg(err));
    } else {
      this.hr.put(`staff/${e.id}`, body).subscribe(() => { this.message = "Saved."; this.open({ id: e.id }); }, err => this.error = this.hr.msg(err));
    }
  }

  leave() {
    this.error = "";
    this.hr.post(`staff/${this.editing.id}/exit`, { exit_date: this.exitDate }).subscribe(() => { this.message = "Marked as left."; this.open({ id: this.editing.id }); }, e => this.error = this.hr.msg(e));
  }

  rejoin() {
    this.hr.post(`staff/${this.editing.id}/rejoin`).subscribe(() => { this.message = "Reactivated."; this.open({ id: this.editing.id }); }, e => this.error = this.hr.msg(e));
  }

  // ------------------------------------------------------------ salary
  startRevision() {
    const last = this.detail?.revisions?.[0];
    const amounts: any = {};
    for (const c of this.components) amounts[c.id] = last?.lines?.find((l: any) => l.component_id === c.id)?.amount ?? null;
    this.rev = { effective_from: this.hr.today().slice(0, 8) + "01", reason: "", amounts };
    this.revising = true;
  }

  saveRevision() {
    this.error = this.message = "";
    const lines = this.components.map(c => ({ component_id: c.id, amount: this.rev.amounts[c.id] })).filter(l => +l.amount > 0);
    this.hr.post(`staff/${this.editing.id}/revisions`, { effective_from: this.rev.effective_from, reason: this.rev.reason, lines })
      .subscribe(() => { this.message = "Salary revision saved."; this.open({ id: this.editing.id }); }, e => this.error = this.hr.msg(e));
  }

  removeRevision(id: number) {
    this.hr.delete(`revisions/${id}`).subscribe(() => this.open({ id: this.editing.id }), e => this.error = this.hr.msg(e));
  }

  earningsOf(rev: any): number { return (rev.lines || []).filter((l: any) => l.kind === "EARNING").reduce((t: number, l: any) => t + l.amount, 0); }
  isFuture(rev: any): boolean { return String(rev.effective_from).slice(0, 10) > this.hr.today(); }
}
