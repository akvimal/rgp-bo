import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { HrService } from "./hr.service";

/**
 * Logins that are not in HR yet, added in one go: tick the people, say what each is and when they started, press one button.
 * Each person added stays on screen with the next step, the salary: open their salary form, or start it from their job role's standard pay.
 */
@Component({ selector: "app-hr-people", templateUrl: "./hr-people.component.html" })
export class HrPeopleComponent implements OnInit {
  @Output() changed = new EventEmitter<void>();
  /** open a person's record, straight to the salary form when salary is true */
  @Output() openStaff = new EventEmitter<{ id: number; salary: boolean }>();

  /** logins still to add, one row each */
  rows: any[] = [];
  /** people added during this visit, kept in view with their next step */
  added: any[] = [];
  positions: any[] = [];
  components: any[] = [];
  kinds: { value: string; label: string }[] = [{ value: "EMPLOYEE", label: "Staff, paid a salary" }];
  private ownerKind = "OWNER";
  busy = false;
  attempted = false;
  message = "";
  error = "";

  constructor(private hr: HrService) {}

  ngOnInit() { this.load(); }

  load() {
    this.hr.get("positions").subscribe(r => this.positions = (r || []).filter((p: any) => p.active), () => {});
    this.hr.get("components").subscribe(r => this.components = r || [], () => {});
    this.hr.get("starter").subscribe(o => {
      // which of owner or director is offered follows how the business is registered; a director is either paid a salary or not
      const rel: string[] = o.relationships || ["EMPLOYEE"];
      const kinds: { value: string; label: string }[] = [];
      if (rel.includes("EMPLOYEE")) kinds.push({ value: "EMPLOYEE", label: "Staff, paid a salary" });
      if (rel.includes("OWNER")) kinds.push({ value: "OWNER", label: "Owner or partner, no salary" });
      if (rel.includes("DIRECTOR")) kinds.push({ value: "DIRECTOR_PAID", label: "Director, paid a salary" }, { value: "DIRECTOR_UNPAID", label: "Director, no salary" });
      this.kinds = kinds;
      this.ownerKind = o.owner_default === "DIRECTOR" ? "DIRECTOR_UNPAID" : "OWNER";
      this.hr.get("staff/candidates").subscribe(r => {
        // the start date is left blank on purpose: it decides leave, bonus service and the first pay month, so it has to be a real answer
        this.rows = r.map((p: any) => ({ ...p, pick: true, kind: p.is_you ? this.ownerKind : "EMPLOYEE", position_id: p.is_you ? null : (p.suggested_position_id || null), join_date: "", error: "" }));
      }, () => {});
    }, () => {});
  }

  isPaid(kind: string): boolean { return kind === "EMPLOYEE" || kind === "DIRECTOR_PAID"; }
  kindLabel(kind: string): string { return this.kinds.find(k => k.value === kind)?.label || kind; }

  get picked(): any[] { return this.rows.filter(r => r.pick); }
  get missingDates(): number { return this.picked.filter(r => !r.join_date).length; }
  get canAdd(): boolean { return !this.busy && this.picked.length > 0 && this.missingDates === 0; }

  toggleAll(on: boolean) { for (const r of this.rows) r.pick = on; }
  get allPicked(): boolean { return this.rows.length > 0 && this.rows.every(r => r.pick); }

  private body(r: any) {
    const pos = this.positions.find(p => p.id === r.position_id);
    return {
      user_id: r.id, designation: pos?.name || "", position_id: r.position_id || null, join_date: r.join_date,
      relationship: r.kind.startsWith("DIRECTOR") ? "DIRECTOR" : r.kind, on_payroll: r.kind === "DIRECTOR_PAID",
    };
  }

  /** add the ticked people one after another; one that cannot be added keeps its row with the reason, and the rest go ahead */
  addPicked() {
    this.attempted = true;
    const todo = this.picked;
    if (!todo.length || todo.some(r => !r.join_date)) return;
    this.busy = true; this.message = this.error = "";
    let ok = 0, bad = 0;
    const next = (i: number) => {
      if (i >= todo.length) {
        this.busy = false;
        this.message = `${ok} ${ok === 1 ? "person" : "people"} added to HR.` + (bad ? ` ${bad} could not be added: see the reason on the row.` : "");
        if (ok) this.changed.emit();
        return;
      }
      const r = todo[i];
      r.error = "";
      this.hr.post("staff", this.body(r)).subscribe(
        res => { ok++; this.rows = this.rows.filter(x => x !== r); this.added = [...this.added, this.addedRow(r, res)]; next(i + 1); },
        e => { bad++; r.error = this.hr.msg(e); next(i + 1); });
    };
    next(0);
  }

  // ------------------------------------------------------------ the next step: the salary
  private addedRow(r: any, res: any) {
    const a: any = { id: res.id, code: res.emp_code, name: r.name, kind: r.kind, paid: this.isPaid(r.kind), position: this.positions.find(p => p.id === r.position_id) || null,
                     role_name: r.role_name, join_date: r.join_date, salary: null, confirm: false, error: "", busy: false };
    a.std = this.structure(a);
    return a;
  }

  /** the pay a first salary would start from: the job role's standard amounts that apply to this person's login role */
  private structure(a: any): { lines: any[]; earnings: number; from: string } | null {
    if (!a.paid || !a.position) return null;
    const lines: any[] = [];
    for (const l of a.position.lines || []) {
      const c = this.components.find(x => x.id === l.component_id);
      if (c && c.active && +l.amount > 0 && (!c.applies_roles?.length || (a.role_name && c.applies_roles.includes(a.role_name)))) lines.push({ component_id: c.id, name: c.name, kind: c.kind, amount: +l.amount });
    }
    const earnings = lines.filter(l => l.kind === "EARNING").reduce((t, l) => t + l.amount, 0);
    if (!(earnings > 0)) return null;
    // the later of the start date and the first of this month, as on the salary form: an old start date does not reopen past months
    const first = this.hr.today().slice(0, 8) + "01";
    return { lines, earnings, from: a.join_date > first ? a.join_date : first };
  }

  useStandardPay(a: any) {
    if (!a.std) return;
    a.busy = true; a.error = "";
    this.hr.post(`staff/${a.id}/revisions`, { effective_from: a.std.from, reason: "Standard pay of the job role", lines: a.std.lines.map((l: any) => ({ component_id: l.component_id, amount: l.amount })) }).subscribe(
      () => { a.busy = false; a.confirm = false; a.salary = { earnings: a.std.earnings, from: a.std.from }; this.changed.emit(); },
      e => { a.busy = false; a.error = this.hr.msg(e); });
  }
}
