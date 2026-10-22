import { Component, OnInit } from "@angular/core";
import { MyHrApi } from "./my-hr.service";
import { printPayslip } from "../hr/payslip-print";

type Tab = "home" | "profile" | "payslips" | "leave" | "attendance" | "credit";

/** A staff member's own HR: where they stand, their details, pay slips, leave, attendance and staff credit. */
@Component({ selector: "app-my-hr", templateUrl: "./my-hr.component.html" })
export class MyHrComponent implements OnInit {
  tab: Tab = "home";
  summary: any = null;
  loaded = false;
  message = "";
  error = "";

  profile: any = null;
  editing = false;
  payslips: any[] = [];
  slip: any = null;
  leave: any = null;
  leaveForm: any = null;
  period = new Date().toISOString().slice(0, 7);
  attendance: any = null;
  credit: any = null;

  readonly dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  readonly statusLabels: { [k: string]: string } = { PENDING: "Waiting", APPROVED: "Approved", REJECTED: "Declined", CANCELLED: "Withdrawn" };

  constructor(private api: MyHrApi) {}

  ngOnInit() {
    this.api.get("summary").subscribe(s => { this.summary = s; this.loaded = true; }, () => this.loaded = true);
  }

  show(t: Tab) {
    this.tab = t; this.message = this.error = ""; this.slip = null;
    if (t === "profile") this.api.get("profile").subscribe(p => { this.profile = p; this.editing = false; });
    if (t === "payslips") this.api.get("payslips").subscribe(r => this.payslips = r.rows || []);
    if (t === "leave") this.loadLeave();
    if (t === "attendance") this.loadAttendance();
    if (t === "credit") this.api.get("credit").subscribe(c => this.credit = c);
  }

  // ------------------------------------------------------------ profile
  edit() { this.editing = true; }
  saveProfile() {
    const p = this.profile;
    this.api.put("profile", { address: p.address, emergency_name: p.emergency_name, emergency_phone: p.emergency_phone })
      .subscribe(() => { this.message = "Saved."; this.show("profile"); }, e => this.error = this.api.msg(e));
  }
  get schedule(): string {
    const p = this.profile;
    if (!p) return "";
    if (p.work_days?.length) return `${p.work_days.map((d: string) => d.charAt(0) + d.slice(1, 3).toLowerCase()).join(", ")}${p.work_start ? " " + p.work_start + "-" + p.work_end : ""}`;
    return p.weekly_off === "ROTATION" ? "Weekly off on rotation" : `Weekly off ${p.weekly_off.charAt(0) + p.weekly_off.slice(1).toLowerCase()}`;
  }

  // ------------------------------------------------------------ pay slips
  openSlip(row: any) { this.error = ""; this.api.get(`payslips/${row.id}`).subscribe(s => this.slip = s, e => this.error = this.api.msg(e)); }
  printSlip() { if (!printPayslip(this.slip)) this.error = "Allow pop-ups to print the pay slip."; }

  // ------------------------------------------------------------ leave
  loadLeave() { this.api.get("leave").subscribe(l => this.leave = l); }
  startLeave() {
    this.message = this.error = "";
    this.leaveForm = { leave_type_id: null, from_date: this.api.today(), to_date: this.api.today(), half_day: false, reason: "" };
  }
  sendLeave() {
    this.error = this.message = "";
    this.api.post("leave", this.leaveForm).subscribe(r => {
      this.message = `Asked for ${r.days} day${r.days === 1 ? "" : "s"}. Your manager will decide.`;
      this.leaveForm = null; this.loadLeave();
      this.api.get("summary").subscribe(s => this.summary = s);
    }, e => this.error = this.api.msg(e));
  }
  withdraw(r: any) { this.api.post(`leave/${r.id}/cancel`).subscribe(() => { this.message = "Request withdrawn."; this.loadLeave(); }, e => this.error = this.api.msg(e)); }
  balanceLeft(b: any) { return Math.max(0, b.entitled - b.used); }

  // ------------------------------------------------------------ attendance
  loadAttendance() { this.api.get("attendance", { period: this.period }).subscribe(a => this.attendance = a); }
  dayList(): any[] {
    const a = this.attendance;
    if (!a?.me) return [];
    return Array.from({ length: a.days }, (_, i) => {
      const d = i + 1;
      const date = `${a.period}-${String(d).padStart(2, "0")}`;
      const dow = new Date(date + "T00:00:00Z").getUTCDay();
      const hol = a.holidays.find((h: any) => h.d === date);
      const mark = a.me.marks[date];
      const lv = a.me.leave[date];
      const outside = date < a.me.join_date || (a.me.exit_date && date > a.me.exit_date);
      const off = a.me.work_days?.length ? !a.me.work_days.includes(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][dow]) : ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][dow] === a.me.weekly_off;
      let text = "", cls = "bg-light text-muted";
      if (outside) { text = "-"; }
      else if (mark === "PRESENT") { text = "P"; cls = "bg-success text-white"; }
      else if (mark === "ABSENT") { text = "A"; cls = "bg-danger text-white"; }
      else if (mark === "HALF_DAY") { text = "½"; cls = "bg-warning text-dark"; }
      else if (lv) { text = "L"; cls = "bg-info text-dark"; }
      else if (hol) { text = "H"; }
      else if (off) { text = "off"; }
      return { d, dow: this.dayNames[dow], text, cls, title: hol ? hol.name : mark ? mark.replace("_", " ").toLowerCase() : lv ? "leave" : off ? "weekly off" : "" };
    });
  }
}
