import { Component, OnInit } from "@angular/core";
import { ReviewService } from "./review.service";

/**
 * Weekly review. The week's exceptions for the stores the reader looks after, set beside the week before. A week can be signed once it is over;
 * the sign-off records who looked, when, and what the figures were.
 */
@Component({
    templateUrl: './review.component.html'
})
export class ReviewComponent implements OnInit {

    loading = true;
    error = '';
    message = '';
    data: any = null;
    storeid: number | null = null;
    weekstart: string | null = null;
    note = '';
    saving = false;

    constructor(private service: ReviewService) {}

    ngOnInit() { this.load(); }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    load() {
        this.loading = true;
        this.service.week(this.storeid, this.weekstart).subscribe((d: any) => {
            this.data = d;
            this.weekstart = d.week.start;
            this.loading = false;
        }, (err: any) => { this.loading = false; this.error = this.msg(err, 'Could not load the weekly review.'); });
    }

    changeStore(id: any) { this.storeid = id ? +id : null; this.message = ''; this.load(); }

    shift(weeks: number) {
        const d = new Date(this.weekstart + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + weeks * 7);
        this.weekstart = d.toISOString().slice(0, 10);
        this.message = ''; this.note = '';
        this.load();
    }

    get thisWeek(): boolean { return !!this.data && !this.data.over; }

    /** the change from the usual figure, as a signed percentage ('' when there is nothing to compare with) */
    change(now: number | null | undefined, usual: number | null | undefined): string {
        if (now === null || now === undefined || usual === null || usual === undefined || usual <= 0) return '';
        const p = Math.round(((now - usual) / usual) * 100);
        return p === 0 ? '0%' : (p > 0 ? '+' : '') + p + '%';
    }

    /** a rate for display ('' when it cannot be worked out, for example no bills) */
    rate(v: number | null | undefined, unit = ''): string { return v === null || v === undefined ? '' : v + unit; }

    /** the words for a verdict: bills and sales are higher or lower, the exceptions above or below usual */
    label(v: string, volume = false): string {
        if (v === 'above') return volume ? 'Higher than usual' : 'Above usual';
        if (v === 'below') return volume ? 'Lower than usual' : 'Below usual';
        return v === 'usual' ? 'As usual' : '';
    }

    /** an exception above usual is a warning; a volume above or below usual is only noted */
    badge(v: string, volume = false): string {
        if (v === 'above') return volume ? 'badge bg-info text-dark' : 'badge bg-warning text-dark';
        if (v === 'below') return volume ? 'badge bg-info text-dark' : 'badge bg-secondary';
        return v === 'usual' ? 'badge bg-light text-dark border' : '';
    }

    /** what an edit changed, in words */
    describe(c: any): string {
        const out: string[] = [];
        const money = (v: any) => Math.round(Number(v) * 100) / 100;
        if (c.total) out.push(`total ${money(c.total.from)} to ${money(c.total.to)}`);
        if (c.discamount) out.push(`discount ${money(c.discamount.from)} to ${money(c.discamount.to)}`);
        if (c.items_removed) out.push(`${c.items_removed} item${c.items_removed > 1 ? 's' : ''} removed`);
        if (c.items_changed) out.push(`${c.items_changed} item${c.items_changed > 1 ? 's' : ''} changed`);
        if (c.cashamt || c.digiamt) out.push('payment changed');
        if (c.status) out.push(`status ${c.status.from} to ${c.status.to}`);
        return out.join(', ');
    }

    sign() {
        this.error = ''; this.message = ''; this.saving = true;
        this.service.signoff({ storeid: this.data.store, weekstart: this.data.week.start, note: this.note }).subscribe(() => {
            this.saving = false; this.note = ''; this.message = 'Signed. The review of this week is recorded.'; this.load();
        }, (err: any) => { this.saving = false; this.error = this.msg(err, 'Could not sign the review.'); });
    }
}
