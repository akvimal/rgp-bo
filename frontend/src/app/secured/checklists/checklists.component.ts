import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { saveAs } from "file-saver";
import { ChecklistsService } from "./checklists.service";

type Tab = 'run' | 'lists' | 'tasks';

/**
 * Checklists: fill in a store's lists, change them, and manage the weekly and monthly tasks the system puts in the store's to-do list.
 */
@Component({
    templateUrl: './checklists.component.html'
})
export class ChecklistsComponent implements OnInit {

    tab: Tab = 'run';
    loading = true;
    error = '';
    message = '';
    data: any = null;
    storeid: number | null = null;
    key = '';

    // filling in a list
    ticks: { [key: string]: boolean } = {};
    values: { [key: string]: string } = {};
    note = '';
    saving = false;
    printing = '';
    history: any[] | null = null;

    // changing a list
    edit: any = null;
    editError = '';
    adding = false;
    newTitle = '';

    // the system's tasks
    tasks: any = null;
    tasksError = '';
    readonly weekdays = [{ v: 1, n: 'Monday' }, { v: 2, n: 'Tuesday' }, { v: 3, n: 'Wednesday' }, { v: 4, n: 'Thursday' }, { v: 5, n: 'Friday' }, { v: 6, n: 'Saturday' }, { v: 0, n: 'Sunday' }];
    readonly monthDays = [{ v: 1, n: '1st' }, { v: 2, n: '2nd' }, { v: 3, n: '3rd' }, { v: 5, n: '5th' }, { v: 7, n: '7th' }, { v: 10, n: '10th' }, { v: 15, n: '15th' }, { v: 20, n: '20th' }, { v: 25, n: '25th' }, { v: 0, n: 'Last day' }];

    constructor(private service: ChecklistsService, private route: ActivatedRoute) {}

    ngOnInit() {
        this.key = this.route.snapshot.queryParamMap.get('key') || '';
        this.load();
    }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    get lists(): any[] { return this.data?.lists || []; }
    get activeLists(): any[] { return this.lists.filter((l) => l.active); }
    get current(): any { return this.lists.find((l) => l.key === this.key) || null; }
    get canEdit(): boolean { return !!this.data?.canedit; }

    load() {
        this.service.overview(this.storeid).subscribe((d: any) => {
            this.data = d;
            this.storeid = d.store?.id ?? null;
            this.loading = false;
            if (!this.activeLists.some((l) => l.key === this.key)) this.key = this.activeLists[0]?.key || '';
            this.ticks = {}; this.values = {}; this.history = null;
            if (this.tab === 'lists') this.startEdit();
        }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the checklists.'); });
    }

    setTab(t: Tab) {
        this.tab = t; this.error = ''; this.message = '';
        if (t === 'lists') this.startEdit();
        if (t === 'tasks') this.loadTasks();
    }

    changeStore(id: any) { this.storeid = +id; this.loading = true; this.message = ''; this.load(); if (this.tab === 'tasks') this.loadTasks(); }

    pick(key: string) { this.key = key; this.ticks = {}; this.values = {}; this.note = ''; this.history = null; this.message = ''; this.error = ''; }

    // ------------------------------------------------------------------ filling in a list
    get ticked(): number { return (this.current?.items || []).filter((i: any) => this.isDone(i)).length; }
    get total(): number { return this.current?.items?.length || 0; }
    isDone(i: any): boolean { return i.auto ? !!i.autoticked : i.kind === 'text' ? !!(this.values[i.key] || '').trim() : !!this.ticks[i.key]; }

    tickAll() { (this.current?.items || []).forEach((i: any) => { if (!i.auto && i.kind !== 'text') this.ticks[i.key] = true; }); }

    save() {
        if (!this.current) return;
        this.error = ''; this.message = ''; this.saving = true;
        this.service.run(this.key, { storeid: this.storeid, ticks: this.ticks, values: this.values, note: this.note }).subscribe((r: any) => {
            this.saving = false;
            this.message = r.complete ? `Saved: ${this.current.title} is complete.` + (r.closedtasks ? ' The matching to-do is ticked.' : '') : 'Saved, but some items are not done. The list counts as done only when every item is.';
            this.note = '';
            this.load();
        }, (err: any) => { this.saving = false; this.error = this.msg(err, 'Could not save the check.'); });
    }

    showHistory() {
        this.service.history(this.key, this.storeid).subscribe((h: any) => this.history = h.items, (err: any) => this.error = this.msg(err, 'Could not load the history.'));
    }

    // ------------------------------------------------------------------ the printed documents
    private open(blob: Blob, filename: string, download: boolean) {
        if (download) { saveAs(blob, filename); return; }
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    printPriceList(format: 'pdf' | 'xlsx') {
        this.error = ''; this.printing = format;
        this.service.priceList(format).subscribe((b: Blob) => {
            this.printing = '';
            this.open(b, `price-list-${new Date().toISOString().slice(0, 10)}.${format}`, format === 'xlsx');
            this.load();
        }, (err: any) => { this.printing = ''; this.error = this.msg(err, 'Could not make the price list.'); });
    }

    printProcedure() {
        this.error = ''; this.printing = 'procedure';
        this.service.procedure().subscribe((b: Blob) => { this.printing = ''; this.open(b, 'outage-procedure.pdf', false); },
            (err: any) => { this.printing = ''; this.error = this.msg(err, 'Could not make the procedure.'); });
    }

    // ------------------------------------------------------------------ changing a list
    startEdit() {
        const l = this.current || this.lists[0];
        if (!l) { this.edit = null; return; }
        this.key = l.key;
        this.edit = { key: l.key, title: l.title, active: l.active, custom: l.custom, source: l.source, scope: 'store', items: l.items.map((i: any) => ({ key: i.key, label: i.label, kind: i.kind, auto: i.auto || null })) };
        this.editError = '';
    }

    pickEdit(key: string) { this.key = key; this.startEdit(); this.message = ''; }

    addItem() { this.edit.items.push({ key: '', label: '', kind: 'tick', auto: null }); }
    removeItem(i: number) { this.edit.items.splice(i, 1); }
    move(i: number, by: number) {
        const j = i + by;
        if (j < 0 || j >= this.edit.items.length) return;
        const [x] = this.edit.items.splice(i, 1);
        this.edit.items.splice(j, 0, x);
    }

    saveEdit() {
        this.editError = ''; this.message = '';
        this.service.saveList(this.edit.key, { storeid: this.storeid, scope: this.edit.scope, title: this.edit.title, active: this.edit.active, items: this.edit.items }).subscribe(() => {
            this.message = this.edit.scope === 'business' ? 'Saved for every store that has no copy of its own.' : 'Saved for this store.';
            this.load();
        }, (err: any) => this.editError = this.msg(err, 'Could not save the checklist.'));
    }

    resetEdit() {
        const scope = this.edit.source === 'business' && this.canOwner ? 'business' : 'store';
        this.service.resetList(this.edit.key, this.storeid, scope).subscribe(() => {
            this.message = this.edit.custom ? 'The checklist is removed.' : 'Put back to the shared list.';
            this.load();
        }, (err: any) => this.editError = this.msg(err, 'Could not put the checklist back.'));
    }

    get canOwner(): boolean { return !!this.data?.owner; }

    createList() {
        this.editError = '';
        this.service.addList({ storeid: this.storeid, scope: this.canOwner && this.edit?.scope === 'business' ? 'business' : 'store', title: this.newTitle, items: [{ label: 'First item', kind: 'tick' }] }).subscribe((r: any) => {
            this.adding = false; this.newTitle = ''; this.key = r.key; this.message = 'Checklist added. Change its items below.';
            this.load();
        }, (err: any) => this.editError = this.msg(err, 'Could not add the checklist.'));
    }

    sourceLabel(s: string): string { return s === 'store' ? "this store's own copy" : s === 'business' ? 'the copy for every store' : 'the standard list'; }

    // ------------------------------------------------------------------ the system's tasks
    loadTasks() {
        this.tasksError = '';
        this.service.tasks(this.storeid).subscribe((t: any) => { this.tasks = t; if (!this.storeid) this.storeid = t.store?.id ?? null; },
            (err: any) => this.tasksError = this.msg(err, 'Could not load the tasks.'));
    }

    dayOptions(t: any): { v: number; n: string }[] { return t.cadence === 'WEEKLY' ? this.weekdays : this.monthDays; }

    dayName(t: any, day: number): string { return this.dayOptions(t).find((d) => d.v === +day)?.n ?? String(day); }

    saveTask(t: any, patch: any, scope: 'store' | 'business' = 'store') {
        this.tasksError = ''; this.message = '';
        this.service.saveTask(t.key, { storeid: this.storeid, scope, enabled: t.enabled, day: t.day, ...patch }).subscribe(() => this.loadTasks(),
            (err: any) => { this.tasksError = this.msg(err, 'Could not save the task.'); this.loadTasks(); });
    }

    toggleTask(t: any, on: boolean) { this.saveTask(t, { enabled: on }); }
    moveTask(t: any, day: any) { this.saveTask(t, { day: +day }); }

    followBusiness(t: any) {
        this.service.resetTask(t.key, this.storeid).subscribe(() => this.loadTasks(), (err: any) => this.tasksError = this.msg(err, 'Could not change the task.'));
    }

    // ------------------------------------------------------------------ small helpers
    ago(n: number | null): string { return n === null || n === undefined ? 'never' : n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'} ago`; }
}
