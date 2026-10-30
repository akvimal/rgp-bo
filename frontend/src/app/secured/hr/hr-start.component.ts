import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { HrService } from "./hr.service";
import { BusinessesService } from "../settings/businesses/businesses.service";

/** Getting started with HR and payroll: how the business is registered, the starter set, job roles, statutory decisions, holidays and the people to add. Lives at the top of HR > Setup. */
@Component({ selector: "app-hr-start", templateUrl: "./hr-start.component.html" })
export class HrStartComponent implements OnInit {
  @Output() changed = new EventEmitter<void>();

  hrOffer: any = null;
  hrPeople: any[] = [];
  hrPicked: { [code: string]: boolean } = {};
  hrMessage = '';
  hrError = '';
  hrBusy = false;
  readonly legalForms = [
    { key: 'PROPRIETORSHIP', label: 'Proprietorship' }, { key: 'PARTNERSHIP', label: 'Partnership firm' }, { key: 'LLP', label: 'Limited liability partnership (LLP)' },
    { key: 'PRIVATE_LIMITED', label: 'Private limited company' }, { key: 'PUBLIC_LIMITED', label: 'Public limited company' }, { key: 'OTHER', label: 'Other (trust, society, ...)' },
  ];
  /** how the business is registered decides how strict the payroll set-up is: limited companies follow the compliance set */
  hrLegalForm = 'PROPRIETORSHIP';
  get hrCompliance(): boolean { return this.hrOffer?.mode === 'COMPLIANCE'; }

  constructor(private hrApi: HrService, private business: BusinessesService) {}

  ngOnInit() { this.loadHr(); }

  get hrStarterMissing(): number { return (this.hrOffer?.starter || []).filter((i: any) => !i.have).length; }
  get hrPickedCodes(): string[] { return Object.keys(this.hrPicked).filter(k => this.hrPicked[k]); }
  hrOf(kind: string): any[] { return (this.hrOffer?.starter || []).filter((i: any) => kind === 'PAY' ? i.kind !== 'LEAVE' : i.kind === 'LEAVE'); }
  hrSuggestions(kind: string): any[] { return (this.hrOffer?.suggestions || []).filter((i: any) => i.kind === kind); }
  get hrChecklist(): { label: string; done: boolean }[] {
    const p = this.hrOffer?.progress || {};
    return [
      { label: 'Pay components', done: p.components > 0 },
      { label: 'Leave types', done: p.leave_types > 0 },
      { label: 'Holidays for this year', done: p.holidays > 0 },
      { label: 'A salary for at least one person', done: p.paid_staff > 0 },
    ];
  }

  /** after something was added or changed here, the sections below it in HR > Setup refresh too */
  private reload() { this.loadHr(); this.changed.emit(); }

  loadHr() {
    this.hrApi.get('starter').subscribe(r => { this.hrOffer = r; this.hrLegalForm = r.legal_form; this.hrStatutory = (r.statutory || []).map((x: any) => ({ ...x, yes: x.applies === null ? null : x.applies }));
      this.hrApi.get('staff/candidates').subscribe(r => this.hrPeople = r.map((p: any) => ({ ...p, designation: '', position_id: p.suggested_position_id || null, join_date: this.hrApi.today(), relationship: p.is_you ? (this.hrOffer?.owner_default || 'OWNER') : 'EMPLOYEE', on_payroll: false })), () => {});
    }, () => this.hrOffer = null);
    this.hrApi.get('positions').subscribe(r => this.hrPositions = (r || []).filter((p: any) => p.active), () => {});
  }

  /** the statutory items of the compliance set, each with its decision being edited */
  hrStatutory: any[] = [];
  get hrStatutoryLeft(): number { return this.hrStatutory.filter(x => x.applies === null).length; }

  setLegalForm() {
    this.hrMessage = this.hrError = '';
    this.business.updateMine({ legalform: this.hrLegalForm }).subscribe(
      () => { this.hrMessage = 'Saved. The starter set below follows how the business is registered. Press "Add the starter set" to add anything it now includes.'; this.reload(); },
      err => { this.hrError = this.hrApi.msg(err); this.reload(); });
  }

  saveStatutory(x: any) {
    this.hrMessage = this.hrError = '';
    const body = { applies: x.yes, reason: x.reason || '', reg_no: x.reg_no || '' };
    this.hrApi.put(`statutory/${x.code}`, body).subscribe(
      () => { this.hrMessage = `${x.name}: saved.`; this.reload(); },
      err => this.hrError = this.hrApi.msg(err));
  }

  /** the job roles on offer that the business does not have yet, and the ones it has */
  hrPositions: any[] = [];
  get hrRolesMissing(): any[] { return this.hrOffer?.roles || []; }

  /** other job roles a shop often has, ticked to add */
  hrRolePicked: { [name: string]: boolean } = {};
  get hrRolePickedNames(): string[] { return Object.keys(this.hrRolePicked).filter(k => this.hrRolePicked[k]); }
  readonly relLabel: { [k: string]: string } = { EMPLOYEE: 'Employee', OWNER: 'Owner or partner (not on payroll)', DIRECTOR: 'Director' };

  hrAdd(starter: boolean, codes: string[], roles = false, roleNames: string[] = []) {
    this.hrMessage = this.hrError = ''; this.hrBusy = true;
    this.hrApi.post('starter', { starter, codes, roles, role_names: roleNames }).subscribe(
      (r: any) => { this.hrBusy = false; this.hrPicked = {}; this.hrRolePicked = {}; const all = [...r.added, ...(r.roles || [])]; this.hrMessage = all.length ? `Added: ${all.join(', ')}.` : 'Nothing to add: you already have these.'; this.reload(); },
      err => { this.hrBusy = false; this.hrError = this.hrApi.msg(err); });
  }

  hrCreateStaff(p: any) {
    this.hrMessage = this.hrError = '';
    this.hrApi.post('staff', { user_id: p.id, designation: p.designation, position_id: p.position_id || null, join_date: p.join_date, relationship: p.relationship, on_payroll: p.relationship === 'DIRECTOR' && !!p.on_payroll }).subscribe(
      () => { this.hrMessage = `${p.name} now has a staff record. Add the salary under HR > Staff.`; this.reload(); },
      err => this.hrError = this.hrApi.msg(err));
  }
}
