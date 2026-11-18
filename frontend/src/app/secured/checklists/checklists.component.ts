import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { saveAs } from "file-saver";
import { ChecklistsService } from "./checklists.service";

/**
 * Checklists: fill in a store's lists (outage readiness, opening, closing, housekeeping). Setting the lists up, and the system's recurring tasks, is in
 * Settings > Checklists.
 */
@Component({
    templateUrl: './checklists.component.html'
})
export class ChecklistsComponent implements OnInit {

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
        }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the checklists.'); });
    }

    changeStore(id: any) { this.storeid = +id; this.loading = true; this.message = ''; this.load(); }

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
    printProcedure() {
        this.error = ''; this.printing = 'procedure';
        this.service.procedure().subscribe((b: Blob) => { this.printing = ''; saveAs(b, 'outage-procedure.pdf'); },
            (err: any) => { this.printing = ''; this.error = this.msg(err, 'Could not make the procedure.'); });
    }

    // ------------------------------------------------------------------ small helpers
    ago(n: number | null): string { return n === null || n === undefined ? 'never' : n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'} ago`; }
}
