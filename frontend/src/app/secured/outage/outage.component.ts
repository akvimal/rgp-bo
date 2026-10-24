import { Component, OnInit } from "@angular/core";
import { saveAs } from "file-saver";
import { OutageKitService } from "./outage.service";

/**
 * Outage kit. The weekly check of what the shop needs to sell by hand if the power or the system goes, the price list and the procedure to print,
 * and a log of each outage with the manual bill numbers used. The page cannot help in an outage, so the procedure is also a printable page.
 */
@Component({
    templateUrl: './outage.component.html'
})
export class OutageComponent implements OnInit {

    loading = true;
    error = '';
    message = '';
    status: any = null;
    storeid: number | null = null;

    // the weekly check
    ticks: { [key: string]: boolean } = {};
    billBookLast = '';
    note = '';
    saving = false;

    // documents
    printing = '';

    // an outage being recorded or corrected
    event: any = this.blankEvent();
    editingId: number | null = null;
    eventError = '';
    readonly causes = [
        { value: 'POWER', label: 'Power cut' }, { value: 'INTERNET', label: 'Internet' },
        { value: 'SERVER', label: 'System down' }, { value: 'OTHER', label: 'Other' },
    ];

    constructor(private service: OutageKitService) {}

    ngOnInit() { this.load(); }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    load() {
        this.service.status(this.storeid).subscribe((s: any) => {
            this.status = s;
            this.storeid = s.store?.id ?? null;
            this.loading = false;
            this.ticks = {};
        }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the outage kit.'); });
    }

    changeStore(id: any) { this.storeid = +id; this.loading = true; this.message = ''; this.load(); }

    // ------------------------------------------------------------------ the weekly check
    get ticked(): number { return Object.values(this.ticks).filter(Boolean).length; }
    get total(): number { return this.status?.checklist?.length || 0; }
    get allTicked(): boolean { return this.total > 0 && this.ticked === this.total; }

    tickAll(on: boolean) { (this.status?.checklist || []).forEach((i: any) => this.ticks[i.key] = on); }

    saveCheck() {
        this.error = ''; this.message = ''; this.saving = true;
        this.service.saveReadiness({ storeid: this.storeid, items: this.ticks, billbooklast: this.billBookLast, note: this.note }).subscribe((r: any) => {
            this.saving = false;
            this.message = r.complete ? 'Saved: the kit is ready for the week.' : 'Saved, but some items are not ready. The kit is not counted as ready until every item is ticked.';
            this.billBookLast = ''; this.note = '';
            this.load();
        }, (err: any) => { this.saving = false; this.error = this.msg(err, 'Could not save the check.'); });
    }

    // ------------------------------------------------------------------ documents
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

    /** days since a date, for "printed 9 days ago" */
    ago(d: string | null): number | null {
        if (!d) return null;
        return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
    }
    get printStale(): boolean { const a = this.ago(this.status?.lastprint?.on); return a === null || a >= (this.status?.within || 7); }

    // ------------------------------------------------------------------ outages
    private blankEvent() { return { cause: 'POWER', startedon: '', endedon: '', manualfrom: '', manualto: '', manualcount: '', note: '' }; }

    private local(d: any): string {
        if (!d) return '';
        const x = new Date(d);
        return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    duration(e: any): string {
        if (!e.ended_on) return 'still open';
        const mins = Math.round((new Date(e.ended_on).getTime() - new Date(e.started_on).getTime()) / 60000);
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60), m = mins % 60;
        return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h${m ? ' ' + m + ' min' : ''}`;
    }

    causeLabel(c: string): string { return this.causes.find((x) => x.value === c)?.label || c; }

    editEvent(e: any) {
        this.editingId = e.id;
        this.event = { cause: e.cause, startedon: this.local(e.started_on), endedon: this.local(e.ended_on), manualfrom: e.manual_from || '', manualto: e.manual_to || '', manualcount: e.manual_count ?? '', note: e.note || '' };
        this.eventError = '';
    }

    cancelEvent() { this.editingId = null; this.event = this.blankEvent(); this.eventError = ''; }

    saveEvent() {
        this.eventError = ''; this.message = '';
        const iso = (v: string) => v ? new Date(v).toISOString() : '';
        const body = { ...this.event, storeid: this.storeid, startedon: iso(this.event.startedon), endedon: iso(this.event.endedon) };
        const call = this.editingId ? this.service.updateEvent(this.editingId, body) : this.service.addEvent(body);
        call.subscribe(() => { this.message = this.editingId ? 'Outage updated.' : 'Outage recorded.'; this.cancelEvent(); this.load(); },
            (err: any) => this.eventError = this.msg(err, 'Could not save the outage.'));
    }
}
