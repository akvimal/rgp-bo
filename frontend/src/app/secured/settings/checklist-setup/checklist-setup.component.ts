import { Component, OnInit } from "@angular/core";
import { ChecklistsService } from "../../checklists/checklists.service";

type Tab = 'lists' | 'tasks';

/**
 * Settings > Checklists: set up the store's checklists and the weekly and monthly tasks the system puts in its to-do list. Admin work: a Store Head
 * sets up their own stores, the owner any store or the whole business (the API enforces it). Filling the lists in is on the Checklists page.
 */
@Component({
    templateUrl: './checklist-setup.component.html'
})
export class ChecklistSetupComponent implements OnInit {

    tab: Tab = 'lists';
    loading = true;
    error = '';
    message = '';
    data: any = null;
    storeid: number | null = null;
    key = '';

    // changing a list
    edit: any = null;
    editError = '';
    adding = false;
    newTitle = '';

    // the order the lists are shown in
    orderOpen = false;
    orderRows: { key: string; title: string; active: boolean }[] = [];
    orderScope: 'store' | 'business' = 'store';
    orderError = '';

    // the system's tasks
    tasks: any = null;
    tasksError = '';
    readonly weekdays = [{ v: 1, n: 'Monday' }, { v: 2, n: 'Tuesday' }, { v: 3, n: 'Wednesday' }, { v: 4, n: 'Thursday' }, { v: 5, n: 'Friday' }, { v: 6, n: 'Saturday' }, { v: 0, n: 'Sunday' }];
    readonly monthDays = [{ v: 1, n: '1st' }, { v: 2, n: '2nd' }, { v: 3, n: '3rd' }, { v: 5, n: '5th' }, { v: 7, n: '7th' }, { v: 10, n: '10th' }, { v: 15, n: '15th' }, { v: 20, n: '20th' }, { v: 25, n: '25th' }, { v: 0, n: 'Last day' }];

    constructor(private service: ChecklistsService) {}

    ngOnInit() { this.load(); }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    get lists(): any[] { return this.data?.lists || []; }
    get current(): any { return this.lists.find((l) => l.key === this.key) || null; }
    get canOwner(): boolean { return !!this.data?.owner; }

    load() {
        this.service.overview(this.storeid).subscribe((d: any) => {
            this.data = d;
            this.storeid = d.store?.id ?? null;
            this.loading = false;
            if (!this.lists.some((l) => l.key === this.key)) this.key = this.lists[0]?.key || '';
            if (this.tab === 'lists') this.startEdit();
        }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the checklists.'); });
    }

    setTab(t: Tab) {
        this.tab = t; this.error = ''; this.message = '';
        if (t === 'lists') this.startEdit(); else this.loadTasks();
    }

    changeStore(id: any) { this.storeid = +id; this.loading = true; this.message = ''; this.load(); if (this.tab === 'tasks') this.loadTasks(); }

    // ------------------------------------------------------------------ the order of the lists
    toggleOrder() {
        this.orderOpen = !this.orderOpen; this.orderError = '';
        if (this.orderOpen) { this.orderRows = this.lists.map((l: any) => ({ key: l.key, title: l.title, active: l.active })); this.orderScope = 'store'; }
    }

    moveListOrder(i: number, by: number) {
        const j = i + by;
        if (j < 0 || j >= this.orderRows.length) return;
        const [x] = this.orderRows.splice(i, 1);
        this.orderRows.splice(j, 0, x);
    }

    saveOrder() {
        this.orderError = ''; this.message = '';
        this.service.saveOrder({ storeid: this.storeid, scope: this.orderScope, keys: this.orderRows.map((r) => r.key) }).subscribe(() => {
            this.message = this.orderScope === 'business' ? 'The order is saved for every store without its own.' : 'The order is saved for this store.';
            this.orderOpen = false; this.load();
        }, (err: any) => this.orderError = this.msg(err, 'Could not save the order.'));
    }

    /** whose order this store follows: its own, the one for every store, or the standard one */
    get orderSource(): string { return this.data?.ordersource || 'default'; }
    get orderSourceLabel(): string { return this.orderSource === 'store' ? "this store's own order" : this.orderSource === 'business' ? 'the order set for every store' : 'the standard order'; }
    get canResetOrder(): boolean { return this.orderSource === 'store' || (this.orderSource === 'business' && this.canOwner); }

    resetOrder() {
        this.orderError = '';
        this.service.resetOrder(this.storeid, this.orderSource === 'business' ? 'business' : 'store').subscribe(() => {
            this.message = 'The order is put back to the shared one.'; this.orderOpen = false; this.load();
        }, (err: any) => this.orderError = this.msg(err, 'Could not put the order back.'));
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

    /** the copy this person owns goes: a store copy (a Store Head or the owner), or the business copy (the owner) */
    get canReset(): boolean { return !!this.edit && this.edit.source !== 'default' && (this.edit.source === 'store' || this.canOwner); }

    resetEdit() {
        const scope = this.edit.source === 'business' && this.canOwner ? 'business' : 'store';
        this.service.resetList(this.edit.key, this.storeid, scope).subscribe(() => {
            this.message = this.edit.custom ? 'The checklist is removed.' : 'Put back to the shared list.';
            this.load();
        }, (err: any) => this.editError = this.msg(err, 'Could not put the checklist back.'));
    }

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

    /** the owner may set a task for every store; everyone else sets it for the store chosen */
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
}
