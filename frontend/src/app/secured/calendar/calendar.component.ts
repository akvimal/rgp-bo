import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { CalendarService } from "./calendar.service";
import { CalendarView, daysOf, groupByDay, localToday, sameMonth, step } from "./calendar-grid";

const TYPES: { key: string; label: string; icon: string }[] = [
  { key: 'holiday', label: 'Holidays', icon: 'bi-brightness-high' },
  { key: 'leave', label: 'Leave', icon: 'bi-person-dash' },
  { key: 'todo', label: 'To-dos', icon: 'bi-check2-circle' },
  { key: 'licence', label: 'Licences', icon: 'bi-patch-check' },
  { key: 'audit', label: 'Stock audits', icon: 'bi-clipboard-data' },
  { key: 'followup', label: 'Follow-ups', icon: 'bi-telephone' },
  { key: 'attendance', label: 'My attendance', icon: 'bi-person-check' },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SAVE_KEY = 'rgp_calendar_view';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styles: [`
    .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--rgp-line, #dee2e6); border-left: 1px solid var(--rgp-line, #dee2e6); }
    .cal-head { padding: 4px 6px; font-size: .75rem; font-weight: 600; text-align: center; border-right: 1px solid var(--rgp-line, #dee2e6); border-bottom: 1px solid var(--rgp-line, #dee2e6); }
    .cal-cell { min-height: 92px; padding: 3px; border-right: 1px solid var(--rgp-line, #dee2e6); border-bottom: 1px solid var(--rgp-line, #dee2e6); cursor: pointer; overflow: hidden; }
    .cal-cell.week { min-height: 220px; }
    .cal-cell.out { opacity: .45; }
    .cal-cell.today .cal-num { background: var(--bs-primary, #4154f1); color: #fff; border-radius: 50%; }
    .cal-cell.picked { box-shadow: inset 0 0 0 2px var(--bs-primary, #4154f1); }
    .cal-num { display: inline-block; min-width: 1.5rem; text-align: center; font-size: .78rem; }
    .cal-chip { display: block; margin-top: 2px; padding: 1px 5px; border-radius: 4px; font-size: .72rem; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 3px solid currentColor; }
    .tone-ok { color: #198754; background: rgba(25, 135, 84, .14); }
    .tone-warn { color: #b27300; background: rgba(255, 193, 7, .2); }
    .tone-bad { color: #c62828; background: rgba(220, 53, 69, .14); }
    .tone-info { color: #0b5ed7; background: rgba(13, 110, 253, .12); }
    .tone-muted { color: #6c757d; background: rgba(108, 117, 125, .14); }
    :host-context(html[data-theme="dark"]) .tone-ok { color: #6fd29e; }
    :host-context(html[data-theme="dark"]) .tone-warn { color: #f0c05a; }
    :host-context(html[data-theme="dark"]) .tone-bad { color: #ff8a8a; }
    :host-context(html[data-theme="dark"]) .tone-info { color: #8fb4ff; }
    :host-context(html[data-theme="dark"]) .tone-muted { color: #aab3c5; }
    .cal-more { font-size: .7rem; }
    .cal-row { display: flex; gap: .5rem; align-items: flex-start; padding: .35rem .5rem; border-radius: 6px; margin-bottom: .35rem; }
    .cal-row .cal-text { color: var(--rgp-text, inherit); }
    @media (max-width: 767px) {
      .cal-grid.is-week { grid-template-columns: 1fr; }
      .cal-grid.is-week .cal-head { display: none; }
      .cal-cell { min-height: 56px; }
      .cal-cell.week { min-height: 0; }
      .cal-chip { font-size: .66rem; }
      /* a month cell is too narrow for words: show a coloured dot per entry, and the day's list below tells what they are */
      .cal-grid:not(.is-week) .cal-chip { display: inline-block; width: 8px; height: 8px; margin: 2px 1px 0; padding: 0; border: 0; border-radius: 50%; font-size: 0; background: currentColor; vertical-align: top; }
      .cal-grid:not(.is-week) .cal-chip * { display: none; }
      .cal-grid:not(.is-week) .cal-more { font-size: .6rem; }
    }
  `]
})
export class CalendarComponent implements OnInit {
  view: CalendarView = 'month';
  cursor = localToday();
  today = localToday();
  picked = localToday();

  entries: any[] = [];
  options: any = { stores: [], manager: false, types: [] };
  store = 0;
  /** the kinds switched off (kept in this browser) */
  hidden: string[] = [];
  loaded = false;
  busy = false;
  error = '';

  days: string[] = [];
  byDay: Record<string, any[]> = {};
  weekdays = WEEKDAYS;
  private seq = 0;

  constructor(private service: CalendarService, private router: Router) {}

  ngOnInit() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      if (['month', 'week', 'day'].includes(saved.view)) this.view = saved.view;
      if (Array.isArray(saved.hidden)) this.hidden = saved.hidden.filter((h: any) => typeof h === 'string');
    } catch { /* a private window: the defaults are fine */ }
    this.service.options().subscribe({
      next: (o) => { this.options = o; this.load(); },
      error: (e) => { this.error = e?.error?.message || 'The calendar could not be opened.'; this.loaded = true; }
    });
  }

  get kinds() { return TYPES.filter((t) => (this.options.types || []).includes(t.key)); }
  get title(): string {
    const [y, m] = this.cursor.split('-');
    if (this.view === 'month') return `${MONTHS[+m - 1]} ${y}`;
    if (this.view === 'week') { const d = this.days; return d.length ? `${this.pretty(d[0])} - ${this.pretty(d[6])}` : ''; }
    return this.pretty(this.cursor, true);
  }
  get pickedEntries(): any[] { return this.byDay[this.picked] || []; }

  pretty(day: string, withWeekday = false): string {
    const [y, m, d] = day.split('-').map(Number);
    const w = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${withWeekday ? w + ', ' : ''}${d} ${MONTHS[m - 1].slice(0, 3)}${withWeekday ? ' ' + y : ''}`;
  }
  dayNum(day: string) { return +day.slice(8, 10); }
  outOfMonth(day: string) { return this.view === 'month' && !sameMonth(day, this.cursor); }
  label(key: string) { return TYPES.find((t) => t.key === key)?.label || key; }
  icon(key: string) { return TYPES.find((t) => t.key === key)?.icon || 'bi-circle'; }
  shown(day: string) { return (this.byDay[day] || []).slice(0, this.view === 'month' ? 3 : 50); }
  more(day: string) { return Math.max(0, (this.byDay[day] || []).length - (this.view === 'month' ? 3 : 50)); }
  isHidden(key: string) { return this.hidden.includes(key); }

  setView(v: CalendarView) { this.view = v; this.remember(); this.load(); }
  go(dir: 1 | -1) { this.cursor = step(this.view, this.cursor, dir); this.picked = this.cursor; this.load(); }
  goToday() { this.cursor = this.today = this.picked = localToday(); this.load(); }
  setStore(id: any) { this.store = +id || 0; this.load(); }

  toggle(key: string) {
    this.hidden = this.isHidden(key) ? this.hidden.filter((h) => h !== key) : [...this.hidden, key];
    this.remember();
    this.load();
  }

  pick(day: string) {
    this.picked = day;
    if (this.view === 'month' && !sameMonth(day, this.cursor)) { this.cursor = day; this.load(); }
  }
  openDay(day: string, ev?: Event) { ev?.stopPropagation(); this.cursor = this.picked = day; this.setView('day'); }

  open(e: any, ev?: Event) {
    ev?.stopPropagation();
    if (e.link) this.router.navigateByUrl(e.link);
  }

  load() {
    const days = daysOf(this.view, this.cursor);
    const asked = this.kinds.map((k) => k.key).filter((k) => !this.isHidden(k));
    this.days = days;
    if (!asked.length) { this.entries = []; this.byDay = groupByDay([], days); this.loaded = true; return; }
    const mine = ++this.seq; // a slow answer for a page already left must not draw over the newer one
    this.busy = true;
    this.error = '';
    this.service.entries(days[0], days[days.length - 1], this.store || null, asked).subscribe({
      next: (r) => {
        if (mine !== this.seq) return;
        this.entries = r.entries || [];
        this.today = r.today || this.today;
        this.byDay = groupByDay(this.entries, days);
        this.busy = false;
        this.loaded = true;
      },
      error: (e) => {
        if (mine !== this.seq) return;
        this.error = e?.error?.message || 'The calendar could not be loaded.';
        this.busy = false;
        this.loaded = true;
      }
    });
  }

  private remember() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ view: this.view, hidden: this.hidden })); } catch { /* storage may be off */ }
  }
}
