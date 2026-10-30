import { AuthService } from "src/app/@core/auth/auth.service";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { HrService } from "./hr.service";

/** Staff list, profile and salary revisions. */
@Component({ selector: "app-hr-staff", templateUrl: "./hr-staff.component.html" })
export class HrStaffComponent implements OnInit {
  rows: any[] = [];
  candidates: any[] = [];
  stores: any[] = [];
  components: any[] = [];
  positions: any[] = [];
  message = "";
  error = "";

  /** null = the list; otherwise the person being edited (id 0 = a new one) */
  editing: any = null;
  detail: any = null;
  exitDate = "";
  readonly days = [["SUNDAY", "Sunday"], ["MONDAY", "Monday"], ["TUESDAY", "Tuesday"], ["WEDNESDAY", "Wednesday"], ["THURSDAY", "Thursday"], ["FRIDAY", "Friday"], ["SATURDAY", "Saturday"]];

  revising = false;
  rev: any = { effective_from: "", reason: "", amounts: {} };

  constructor(private hr: HrService, private route: ActivatedRoute, public auth: AuthService) {}

  ngOnInit() { this.load(); }

  load() {
    this.hr.get("staff").subscribe(r => this.rows = r, e => this.error = this.hr.msg(e));
    this.hr.get("staff/candidates").subscribe(r => {
      this.candidates = r;
      this.openFromQuery();
    });
    this.hr.get("stores").subscribe(r => this.stores = r);
    this.hr.get("components").subscribe(r => this.components = (r || []).filter((c: any) => c.active));
    this.hr.get("positions").subscribe(r => this.positions = r || [], () => {});
  }

  /** arriving from Settings > Users: ?user=<login> starts a record for it, ?staff=<id> opens the existing one */
  private openFromQuery() {
    const q = this.route.snapshot.queryParamMap;
    const userId = Number(q.get("user")), staffId = Number(q.get("staff"));
    if (staffId && !this.editing) { this.open({ id: staffId }); return; }
    if (userId && !this.editing && this.candidates.some(c => c.id === userId)) {
      this.add();
      this.editing.user_id = userId;
      this.loginChanged();
    }
  }

  add() {
    this.message = this.error = "";
    this.detail = null;
    this.editing = { id: 0, work_days: [], work_start: "", work_end: "", has_login: true, full_name: "", phone: "", user_id: null, emp_code: "", designation: "", position_id: null, store_id: null, emp_type: "FULL_TIME", join_date: this.hr.today(), weekly_off: "SUNDAY" };
  }

  open(r: any) {
    this.message = this.error = "";
    this.hr.get(`staff/${r.id}`).subscribe(d => {
      this.detail = d;
      this.editing = { ...d, work_days: d.work_days || [], work_start: d.work_start || "", work_end: d.work_end || "", join_date: String(d.join_date).slice(0, 10), pharmacist_valid_to: d.pharmacist_valid_to ? String(d.pharmacist_valid_to).slice(0, 10) : "", dob: d.dob ? String(d.dob).slice(0, 10) : "" };
      this.revising = false;
      this.exitDate = this.hr.today();
      this.loadAccounts();
    }, e => this.error = this.hr.msg(e));
  }

  /** the stores of the chosen login (new record) or of the person being edited */
  get loginStores(): any[] {
    const e = this.editing;
    if (!e) return [];
    if (!e.id && !e.has_login) return this.stores;
    if (e.id && !e.has_login) return this.stores;
    if (e.id) return e.stores || [];
    return this.candidates.find(c => c.id === e.user_id)?.stores || [];
  }

  loginChanged() {
    const st = this.loginStores;
    this.editing.store_id = st.length === 1 && this.editing.has_login ? st[0].id : null;
    // the job role usually held with this login role, when exactly one fits; only a hint, and the owner can change it
    const suggested = this.candidates.find(c => c.id === this.editing.user_id)?.suggested_position_id;
    if (suggested && !this.editing.position_id) { this.editing.position_id = suggested; this.positionChanged(); }
  }

  toggleDay(code: string) {
    const d: string[] = this.editing.work_days || [];
    this.editing.work_days = d.includes(code) ? d.filter(x => x !== code) : [...d, code];
  }

  /** "Mon, Wed, Fri 09:00-13:00" for the list */
  schedule(r: any): string {
    if (r.emp_type !== "PART_TIME") return "";
    const days = (r.work_days || []).map((x: string) => x.charAt(0) + x.slice(1, 3).toLowerCase()).join(", ");
    const hrs = r.work_start && r.work_end ? `${r.work_start}-${r.work_end}` : "";
    return [days, hrs].filter(Boolean).join(" ");
  }

  storeNames(r: any): string {
    const names = (r.stores || []).map((s: any) => s.name);
    return names.length ? names.join(", ") : (r.store || "");
  }

  back() { this.editing = null; this.detail = null; this.load(); }

  save() {
    this.message = this.error = "";
    const e = this.editing;
    const body: any = {
      emp_code: e.emp_code, designation: e.designation, position_id: e.position_id || null, pharmacist_reg_no: e.pharmacist_reg_no || null, pharmacist_council: e.pharmacist_council || null, pharmacist_valid_to: e.pharmacist_valid_to || null, store_id: e.store_id, emp_type: e.emp_type, join_date: e.join_date, weekly_off: e.weekly_off,
      dob: e.dob || null, address: e.address, emergency_name: e.emergency_name, emergency_phone: e.emergency_phone,
      pan: e.pan, aadhaar_last4: e.aadhaar_last4, bank_name: e.bank_name, account_no: e.account_no, ifsc: e.ifsc, notes: e.notes,
    };
    const pt = e.emp_type === "PART_TIME";
    body.work_days = pt ? e.work_days : [];
    body.work_start = pt && e.work_start ? e.work_start : null;
    body.work_end = pt && e.work_end ? e.work_end : null;
    if (!e.has_login) { body.full_name = e.full_name; body.phone = e.phone; }
    if (!e.id) {
      body.user_id = e.has_login ? e.user_id : null;
      this.hr.post("staff", body).subscribe(r => { this.message = `Staff record added (${r.emp_code}). Now set their salary.`; this.open({ id: r.id }); }, err => this.error = this.hr.msg(err));
    } else {
      this.hr.put(`staff/${e.id}`, body).subscribe(() => { this.message = "Saved."; this.open({ id: e.id }); }, err => this.error = this.hr.msg(err));
    }
  }

  linkUserId: number | null = null;

  /** other logins this person also uses (a shared counter login, a sales login): their sales, shifts and ratings count as theirs */
  accounts: any = null;
  extraLogin: number | null = null;

  loadAccounts() {
    this.accounts = null;
    if (!this.editing?.id || !this.editing.has_login) return;
    this.hr.get(`staff/${this.editing.id}/accounts`).subscribe(r => this.accounts = r, () => this.accounts = null);
  }

  saveAccounts(userids: number[]) {
    this.error = this.message = "";
    this.hr.put(`staff/${this.editing.id}/accounts`, { userids }).subscribe(r => {
      this.accounts = r; this.extraLogin = null; this.message = "Logins saved.";
    }, e => this.error = this.hr.msg(e));
  }

  addAccount() { if (this.extraLogin) this.saveAccounts([...this.accounts.linked.map((l: any) => l.id), this.extraLogin]); }
  removeAccount(id: number) { this.saveAccounts(this.accounts.linked.filter((l: any) => l.id !== id).map((l: any) => l.id)); }

  linkLogin() {
    this.error = this.message = "";
    this.hr.post(`staff/${this.editing.id}/login`, { user_id: this.linkUserId }).subscribe(() => {
      this.message = "Login linked.";
      this.linkUserId = null;
      this.hr.get("staff/candidates").subscribe(r => this.candidates = r);
      this.open({ id: this.editing.id });
    }, e => this.error = this.hr.msg(e));
  }

  leave() {
    this.error = "";
    this.hr.post(`staff/${this.editing.id}/exit`, { exit_date: this.exitDate }).subscribe(() => { this.message = "Marked as left."; this.open({ id: this.editing.id }); }, e => this.error = this.hr.msg(e));
  }

  /** a record added by mistake; the server refuses once there is history */
  remove() {
    if (!confirm(`Delete ${this.editing.name || this.editing.full_name}? This record was added by mistake and nothing else depends on it. It cannot be undone.`)) return;
    this.error = "";
    this.hr.delete(`staff/${this.editing.id}`).subscribe(() => { this.back(); this.message = "Staff record deleted."; }, e => this.error = this.hr.msg(e));
  }

  rejoin() {
    this.hr.post(`staff/${this.editing.id}/rejoin`).subscribe(() => { this.message = "Reactivated."; this.open({ id: this.editing.id }); }, e => this.error = this.hr.msg(e));
  }

  // ------------------------------------------------------------ salary
  /** the pay components that apply to this person's role */
  get revisionComponents(): any[] {
    const role = this.detail?.role_name || null;
    return this.components.filter(c => !c.applies_roles?.length || (role && c.applies_roles.includes(role)));
  }

  startRevision() {
    const last = this.detail?.revisions?.[0];
    const amounts: any = {};
    for (const c of this.revisionComponents) amounts[c.id] = last?.lines?.find((l: any) => l.component_id === c.id)?.amount ?? null;
    this.rev = { effective_from: this.hr.today().slice(0, 8) + "01", reason: "", amounts };
    // a first salary starts from the job role's structure, when there is one
    if (!last && this.detail?.position_id) this.useStructure();
    this.revising = true;
  }

  /** the job role this person holds */
  get myPosition(): any { return this.positions.find(p => p.id === this.detail?.position_id) || null; }

  /** fill the amounts from the job role's pay structure; every amount can still be changed before saving */
  useStructure() {
    const p = this.myPosition;
    if (!p) return;
    for (const l of p.lines || []) if (this.revisionComponents.some(c => c.id === l.component_id)) this.rev.amounts[l.component_id] = l.amount;
  }

  /** choosing a job role fills the designation when it is still blank */
  positionChanged() {
    const p = this.positions.find(x => x.id === this.editing.position_id);
    if (p && !String(this.editing.designation || "").trim()) this.editing.designation = p.name;
  }

  saveRevision() {
    this.error = this.message = "";
    const lines = this.revisionComponents.map(c => ({ component_id: c.id, amount: this.rev.amounts[c.id] })).filter(l => +l.amount > 0);
    this.hr.post(`staff/${this.editing.id}/revisions`, { effective_from: this.rev.effective_from, reason: this.rev.reason, lines })
      .subscribe(() => { this.message = "Salary revision saved."; this.open({ id: this.editing.id }); }, e => this.error = this.hr.msg(e));
  }

  removeRevision(id: number) {
    this.hr.delete(`revisions/${id}`).subscribe(() => this.open({ id: this.editing.id }), e => this.error = this.hr.msg(e));
  }

  earningsOf(rev: any): number { return (rev.lines || []).filter((l: any) => l.kind === "EARNING").reduce((t: number, l: any) => t + l.amount, 0); }
  isFuture(rev: any): boolean { return String(rev.effective_from).slice(0, 10) > this.hr.today(); }
}
