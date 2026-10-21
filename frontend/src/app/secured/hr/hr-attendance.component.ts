import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/**
 * Attendance for the month. A click cycles a day: blank -> present -> absent -> half day -> weekly off -> holiday -> blank.
 * Approved leave shows as L (paid) / U (unpaid) and cannot be edited here. Days nobody marks are paid as worked.
 * The staff app (later) will write the same records with a selfie.
 */
@Component({ selector: "app-hr-attendance", templateUrl: "./hr-attendance.component.html" })
export class HrAttendanceComponent implements OnInit {
  period = new Date().toISOString().slice(0, 7);
  grid: any = null;
  days: number[] = [];
  message = "";
  error = "";

  private readonly cycle = [null, "PRESENT", "ABSENT", "HALF_DAY", "WEEKLY_OFF", "HOLIDAY"];
  private readonly short: any = { PRESENT: "P", ABSENT: "A", HALF_DAY: "H", WEEKLY_OFF: "W", HOLIDAY: "HD" };

  constructor(private hr: HrService) {}

  ngOnInit() { this.load(); }

  load() {
    this.error = "";
    this.hr.get("attendance", { period: this.period }).subscribe(g => { this.grid = g; this.days = Array.from({ length: g.days }, (_, i) => i + 1); }, e => this.error = this.hr.msg(e));
  }

  date(d: number) { return `${this.period}-${String(d).padStart(2, "0")}`; }

  cell(s: any, d: number): { text: string; cls: string; title: string; locked: boolean } {
    const dt = this.date(d);
    const lv = s.leave[dt];
    if (lv) return { text: lv.paid ? "L" : "U", cls: lv.paid ? "bg-info text-dark" : "bg-secondary text-white", title: lv.paid ? "Paid leave" : "Unpaid leave", locked: true };
    const m = s.marks[dt];
    const outside = dt < s.join_date || (s.exit_date && dt > s.exit_date);
    if (outside) return { text: "", cls: "bg-light", title: "Not employed", locked: true };
    if (m) {
      const cls = m === "PRESENT" ? "bg-success text-white" : m === "ABSENT" ? "bg-danger text-white" : m === "HALF_DAY" ? "bg-warning text-dark" : "bg-light text-muted";
      return { text: this.short[m], cls, title: m.replace("_", " ").toLowerCase(), locked: false };
    }
    const sunday = new Date(dt + "T00:00:00Z").getUTCDay() === 0 && s.weekly_off === "SUNDAY";
    const hol = this.grid.holidays.find((h: any) => h.d === dt);
    return { text: "", cls: sunday || hol ? "bg-light" : "", title: hol ? hol.name : sunday ? "Weekly off (Sunday)" : "Not marked: paid as worked", locked: false };
  }

  click(s: any, d: number) {
    const c = this.cell(s, d);
    if (c.locked) return;
    const dt = this.date(d);
    if (dt > this.hr.today()) { this.error = "Attendance cannot be marked for a future date."; return; }
    const cur = s.marks[dt] || null;
    const next = this.cycle[(this.cycle.indexOf(cur) + 1) % this.cycle.length];
    this.error = "";
    this.hr.put("attendance", { employee_id: s.id, date: dt, status: next }).subscribe(() => {
      if (next) s.marks[dt] = next; else delete s.marks[dt];
    }, e => this.error = this.hr.msg(e));
  }

  count(s: any, status: string): number { return Object.values(s.marks).filter(m => m === status).length; }
}
