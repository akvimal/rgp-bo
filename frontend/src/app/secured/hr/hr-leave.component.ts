import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/** Leave requests, approval and balances. */
@Component({ selector: "app-hr-leave", templateUrl: "./hr-leave.component.html" })
export class HrLeaveComponent implements OnInit {
  year = new Date().getFullYear();
  requests: any[] = [];
  balances: any[] = [];
  staff: any[] = [];
  types: any[] = [];
  message = "";
  error = "";

  form: any = null;
  deciding: { id: number; action: string; note: string } | null = null;

  /** leave types open to the chosen person's role */
  get typesForPerson(): any[] {
    const role = this.staff.find(s => s.id === this.form?.employee_id)?.role_name || null;
    return this.types.filter(t => !t.applies_roles?.length || (role && t.applies_roles.includes(role)));
  }

  constructor(private hr: HrService) {}

  ngOnInit() {
    this.hr.get("staff").subscribe(r => this.staff = r.filter((s: any) => s.status === "ACTIVE"));
    this.hr.get("leave/types").subscribe(r => this.types = r.filter((t: any) => t.active));
    this.load();
  }

  load() {
    this.hr.get("leave/requests").subscribe(r => this.requests = r, e => this.error = this.hr.msg(e));
    this.hr.get("leave/balances", { year: this.year }).subscribe(r => this.balances = r);
  }

  add() {
    this.message = this.error = "";
    this.form = { employee_id: null, leave_type_id: null, from_date: this.hr.today(), to_date: this.hr.today(), half_day: false, reason: "" };
  }

  save() {
    this.message = this.error = "";
    this.hr.post("leave/requests", this.form).subscribe(r => { this.message = `Leave recorded (${r.days} days), waiting for approval.`; this.form = null; this.load(); }, e => this.error = this.hr.msg(e));
  }

  decide(id: number, action: string) {
    this.message = this.error = "";
    if (action === "reject" && !this.deciding) { this.deciding = { id, action, note: "" }; return; }
    const note = this.deciding?.note || "";
    this.hr.post(`leave/requests/${id}/decision`, { action, note }).subscribe(() => { this.deciding = null; this.message = `Leave ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled"}.`; this.load(); },
      e => this.error = this.hr.msg(e));
  }

  /** balances grouped per person */
  get people(): any[] {
    const by = new Map<number, any>();
    for (const b of this.balances) {
      if (!by.has(b.employee_id)) by.set(b.employee_id, { name: b.name, rows: [] });
      by.get(b.employee_id).rows.push(b);
    }
    return Array.from(by.values());
  }

  badge(s: string) { return s === "APPROVED" ? "bg-success" : s === "PENDING" ? "bg-warning text-dark" : "bg-secondary"; }
}
