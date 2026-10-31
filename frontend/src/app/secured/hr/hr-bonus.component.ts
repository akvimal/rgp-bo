import { Component, OnInit } from "@angular/core";
import { HrService } from "./hr.service";

/** Bonuses for a pay month: a festival bonus to everyone who qualifies, or one bonus to one person. Payroll adds them to the pay. */
@Component({ selector: "app-hr-bonus", templateUrl: "./hr-bonus.component.html" })
export class HrBonusComponent implements OnInit {
  period = "";
  data: any = null;
  positions: any[] = [];
  staff: any[] = [];
  message = "";
  error = "";
  busy = false;

  readonly kinds = [["FESTIVAL", "Festival"], ["PERFORMANCE", "Performance"], ["REFERRAL", "Referral"], ["OTHER", "Other"]];
  readonly bases = [["FIXED", "A fixed amount each"], ["BASIC_PCT", "A share of Basic"], ["GROSS_PCT", "A share of the full salary"]];

  form: any = { name: "", kind: "FESTIVAL", basis: "BASIC_PCT", value: 100, min_service_months: 6, position_id: null };
  preview: any = null;
  left = new Set<number>();                        // people unticked in the preview
  amounts: { [id: number]: number } = {};          // amounts changed in the preview

  one: any = { employee_id: null, name: "", kind: "PERFORMANCE", amount: null, note: "" };
  editId = 0;
  editAmount: number | null = null;

  constructor(private hr: HrService) {}

  ngOnInit() {
    // a bonus rides with the salary of a month, which is worked out in the next one
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    this.period = d.toISOString().slice(0, 7);
    this.hr.get("positions").subscribe(r => this.positions = r.filter((p: any) => p.active), () => {});
    this.hr.get("staff").subscribe(r => this.staff = r.filter((s: any) => s.on_payroll !== false && s.status !== "EXITED"), () => {});
    this.load();
  }

  load() {
    this.hr.get("bonuses", { period: this.period }).subscribe(r => this.data = r, e => this.error = this.hr.msg(e));
  }

  pick() { this.message = this.error = ""; this.preview = null; this.load(); }

  get valueLabel(): string { return this.form.basis === "FIXED" ? "Amount" : "Percent"; }

  private body() { return { ...this.form, period: this.period, value: +this.form.value, position_id: this.form.position_id || null }; }

  runPreview() {
    this.message = this.error = "";
    this.hr.post("bonuses/preview", this.body()).subscribe(r => {
      this.preview = r; this.left = new Set<number>(); this.amounts = {};
      for (const x of r.eligible) this.amounts[x.employee_id] = x.amount;
    }, e => { this.preview = null; this.error = this.hr.msg(e); });
  }

  toggle(id: number) { if (this.left.has(id)) this.left.delete(id); else this.left.add(id); }

  get givingCount(): number { return this.preview ? this.preview.eligible.filter((x: any) => !this.left.has(x.employee_id)).length : 0; }
  get givingTotal(): number {
    if (!this.preview) return 0;
    return Math.round(this.preview.eligible.filter((x: any) => !this.left.has(x.employee_id)).reduce((t: number, x: any) => t + (+this.amounts[x.employee_id] || 0), 0) * 100) / 100;
  }

  give() {
    this.message = this.error = ""; this.busy = true;
    const changed: any = {};
    for (const x of this.preview.eligible) if (+this.amounts[x.employee_id] !== x.amount) changed[x.employee_id] = this.amounts[x.employee_id];
    this.hr.post("bonuses", { ...this.body(), exclude: Array.from(this.left), amounts: changed }).subscribe(r => {
      this.busy = false; this.preview = null;
      this.message = `${this.form.name} given to ${r.given} staff, ${r.total.toFixed(2)} in all.`;
      this.load();
    }, e => { this.busy = false; this.error = this.hr.msg(e); });
  }

  giveOne() {
    this.message = this.error = "";
    this.hr.post("bonuses/item", { ...this.one, period: this.period }).subscribe(() => {
      this.message = "Bonus recorded."; this.one = { employee_id: null, name: "", kind: "PERFORMANCE", amount: null, note: "" }; this.load();
    }, e => this.error = this.hr.msg(e));
  }

  startEdit(i: any) { this.editId = i.id; this.editAmount = i.amount; }

  saveEdit(i: any) {
    this.message = this.error = "";
    this.hr.put(`bonuses/items/${i.id}`, { amount: this.editAmount }).subscribe(() => { this.editId = 0; this.message = "Bonus changed."; this.load(); }, e => this.error = this.hr.msg(e));
  }

  remove(i: any) {
    this.message = this.error = "";
    this.hr.delete(`bonuses/items/${i.id}`).subscribe(() => { this.message = "Bonus removed."; this.load(); }, e => this.error = this.hr.msg(e));
  }
}
