import { Component, OnInit } from "@angular/core";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { TodoService } from "./todos.service";

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** a yyyy-mm-dd string from the browser's own clock (the shop and its browsers are in the same place) */
const localDay = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Component({
  selector: 'app-todos',
  templateUrl: './todos.component.html'
})
export class TodosComponent implements OnInit {
  scope: 'mine' | 'team' = 'mine';
  items: any[] = [];
  doneItems: any[] = [];
  options: any = { people: [], stores: [], canassign: false, me: null };
  repeats: any[] = [];
  showRepeats = false;
  loaded = false;
  busy = false;
  error = '';
  message = '';

  dayNames = DAY_NAMES;
  form: any = this.blank();
  /** the to-do being changed (the add form is reused for it) */
  editing: any = null;
  more = false;

  constructor(private service: TodoService, private confirm: ConfirmService, private operator: OperatorContextService) {}

  ngOnInit() {
    this.service.options().subscribe({
      next: (o: any) => { this.options = o; if (!this.form.storeid && o.stores?.length) this.form.storeid = o.stores[0].id; },
      error: () => {}
    });
    this.load();
  }

  private blank() {
    return { title: '', notes: '', dueday: localDay(), duetime: '09:00', priority: 'normal', who: 'me', storeid: null,
             repeat: '', days: [] as number[], day: 1, every: 7, endson: '', soondays: 1, escalatedays: 3 };
  }

  private fail(err: any, fallback: string) {
    this.busy = false;
    this.message = '';
    const m = err?.error?.message;
    this.error = (Array.isArray(m) ? m.join(' ') : m) || fallback;
  }

  load() {
    this.service.list(this.scope, 'open').subscribe({
      next: (r: any) => {
        const all = r.items || [];
        this.items = all.filter((i: any) => i.status === 'OPEN');
        this.doneItems = all.filter((i: any) => i.status !== 'OPEN');
        this.loaded = true;
      },
      error: (e) => { this.loaded = true; this.fail(e, 'Could not load the to-dos.'); }
    });
    this.service.repeats().subscribe({ next: (r: any) => this.repeats = r.items || [], error: () => {} });
  }

  setScope(s: 'mine' | 'team') { this.scope = s; this.load(); }

  // ---- what is shown where
  get today() { return localDay(); }
  get overdue() { return this.items.filter((i) => i.dueday < this.today); }
  get dueToday() { return this.items.filter((i) => i.dueday === this.today); }
  get later() { return this.items.filter((i) => i.dueday > this.today); }

  stageLabel(i: any): string {
    return i.stage === 'escalated' ? 'Very late' : i.stage === 'overdue' ? 'Late' : i.stage === 'due' ? 'Due now' : i.stage === 'soon' ? 'Coming up' : '';
  }
  stageClass(i: any): string {
    return i.stage === 'escalated' ? 'bg-danger' : i.stage === 'overdue' ? 'bg-warning text-dark' : i.stage === 'due' ? 'bg-primary' : 'bg-secondary';
  }

  whoFor(i: any): string {
    if (i.pool) return `${i.store || 'Store'} (anyone at the store)`;
    return i.assigneeuserid === this.options.me ? 'You' : (i.assignee || '');
  }

  repeatText(r: any): string {
    if (!r) return '';
    switch (r.repeat) {
      case 'DAILY': return 'every day';
      case 'WEEKDAYS': return 'every weekday';
      case 'WEEKLY': return 'every ' + (r.days || []).map((d: number) => DAY_NAMES[d]).join(', ');
      case 'MONTHLY': return r.day === 0 ? 'on the last day of every month' : `on day ${r.day} of every month`;
      case 'EVERY_N_DAYS_AFTER_DONE': return `${r.every} days after it is done`;
      default: return '';
    }
  }

  // ---- adding and changing
  toggleDay(d: number) {
    const i = this.form.days.indexOf(d);
    if (i >= 0) this.form.days.splice(i, 1); else this.form.days.push(d);
  }

  private body() {
    const f = this.form;
    const b: any = { title: String(f.title || '').trim(), notes: f.notes || null, dueday: f.dueday, duetime: f.duetime, priority: f.priority,
                     soondays: f.soondays, escalatedays: f.escalatedays };
    if (this.options.canassign && String(f.who).startsWith('pool')) { b.pool = true; b.storeid = f.storeid; }
    else if (String(f.who).startsWith('u:')) b.assigneeuserid = +String(f.who).slice(2);
    if (!this.editing && f.repeat) {
      b.repeat = { repeat: f.repeat, days: f.repeat === 'WEEKLY' ? f.days : null, day: f.repeat === 'MONTHLY' ? +f.day : null,
                   every: f.repeat === 'EVERY_N_DAYS_AFTER_DONE' ? +f.every : null, endson: f.endson || null };
    }
    return b;
  }

  save() {
    this.busy = true; this.error = ''; this.message = '';
    const call = this.editing ? this.service.update(this.editing.id, this.body()) : this.service.create(this.body());
    call.subscribe({
      next: (r: any) => {
        this.busy = false;
        this.message = this.editing ? 'Saved.' : (r?.templateid && !r?.id ? 'Added. The first one will appear when its day comes.' : 'Added.');
        this.editing = null;
        const keep = { storeid: this.form.storeid, who: this.form.who };
        this.form = { ...this.blank(), ...keep };
        this.more = false;
        this.load();
      },
      error: (e) => this.fail(e, 'Could not save the to-do.')
    });
  }

  edit(i: any) {
    this.editing = i;
    this.error = ''; this.message = '';
    const t = new Date(i.dueon);
    this.form = { ...this.blank(), title: i.title, notes: i.notes || '', dueday: i.dueday, priority: i.priority, soondays: i.soondays, escalatedays: i.escalatedays,
                  duetime: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`,
                  who: i.pool ? 'pool' : (i.assigneeuserid === this.options.me ? 'me' : 'u:' + i.assigneeuserid), storeid: i.storeid || this.form.storeid };
    this.more = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() { this.editing = null; this.form = { ...this.blank(), storeid: this.form.storeid }; this.more = false; }

  // ---- ticking
  tick(i: any) {
    this.error = ''; this.message = '';
    // at a shared counter login the tick is credited to the person serving
    this.service.done(i.id, { actinguserid: this.operator.selectedOperatorId || undefined }).subscribe({
      next: () => { this.message = `"${i.title}" is done.`; this.load(); },
      error: (e) => this.fail(e, 'Could not tick it.')
    });
  }

  reopen(i: any) {
    this.error = ''; this.message = '';
    this.service.reopen(i.id).subscribe({ next: () => this.load(), error: (e) => this.fail(e, 'Could not reopen it.') });
  }

  remove(i: any) {
    this.confirm.confirmDelete(i.title, () => {
      this.service.remove(i.id).subscribe({ next: () => { this.message = 'Removed.'; this.load(); }, error: (e) => this.fail(e, 'Could not remove it.') });
    }, { entity: 'to-do', verb: 'Remove', consequence: i.templateid ? 'The repeat goes on; stop it under "Repeating to-dos".' : '', reversible: false });
  }

  stopRepeat(r: any) {
    this.confirm.confirmDelete(r.title, () => {
      this.service.stopRepeat(r.id).subscribe({ next: () => { this.message = 'The repeat is stopped. To-dos already made stay.'; this.load(); }, error: (e) => this.fail(e, 'Could not stop it.') });
    }, { entity: 'repeat', verb: 'Stop', consequence: 'No more will be made; the ones already on the list stay.', reversible: false });
  }
}
