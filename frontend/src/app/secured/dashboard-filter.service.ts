import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

export type Period = 'month' | 'lastmonth' | '6m' | '12m' | 'fy' | 'lastfy';
export type Compare = 'none' | 'prev' | 'yoy';
export interface DashFilter { period: Period; compare: Compare }

export const PERIODS: { key: Period; label: string }[] = [
    { key: 'month', label: 'This month' }, { key: 'lastmonth', label: 'Last month' }, { key: '6m', label: 'Last 6 months' },
    { key: '12m', label: 'Last 12 months' }, { key: 'fy', label: 'This financial year' }, { key: 'lastfy', label: 'Last financial year' },
];
export const COMPARES: { key: Compare; label: string }[] = [
    { key: 'none', label: 'No comparison' }, { key: 'prev', label: 'Compare with the period before' }, { key: 'yoy', label: 'Compare with last year' },
];

const KEY = 'rgp.dashboard.filter';
const DEFAULT: DashFilter = { period: 'fy', compare: 'none' };

/** "YYYY-MM" shifted by a number of months */
const shift = (ym: string, by: number) => { const t = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + by; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

/** the first and last month ("YYYY-MM") of a period, from today's date in India */
export function rangeOf(period: Period, now: Date = new Date()): { from: string; to: string } {
    const ist = new Date(now.getTime() + 5.5 * 3600000);
    const y = ist.getUTCFullYear(), m = ist.getUTCMonth() + 1;
    const here = `${y}-${String(m).padStart(2, '0')}`;
    const fyStart = m >= 4 ? y : y - 1;
    switch (period) {
        case 'month': return { from: here, to: here };
        case 'lastmonth': return { from: shift(here, -1), to: shift(here, -1) };
        case '6m': return { from: shift(here, -5), to: here };
        case '12m': return { from: shift(here, -11), to: here };
        case 'lastfy': return { from: `${fyStart - 1}-04`, to: `${fyStart}-03` };
        default: return { from: `${fyStart}-04`, to: `${fyStart + 1}-03` };
    }
}

/** a value from the page address or the saved choice that is one of the known keys, else the default */
export function cleanFilter(raw: any): DashFilter {
    const p = PERIODS.find((x) => x.key === raw?.period)?.key ?? DEFAULT.period;
    const c = COMPARES.find((x) => x.key === raw?.compare)?.key ?? DEFAULT.compare;
    return { period: p, compare: c };
}

/**
 * The one period and compare choice for the dashboard cards that depend on a period. It is kept in the page address (so a link shows the same figures to
 * whoever opens it) and remembered per browser. A card that has its own fixed window (sales patterns, stock now) says so and does not use it.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFilterService {
    private readonly state = new BehaviorSubject<DashFilter>(this.initial());
    readonly filter$ = this.state.asObservable();

    get value(): DashFilter { return this.state.value; }

    private initial(): DashFilter {
        try {
            const q = new URLSearchParams(window.location.search);
            if (q.has('period') || q.has('compare')) return cleanFilter({ period: q.get('period'), compare: q.get('compare') });
        } catch { /* no address to read */ }
        try { const s = localStorage.getItem(KEY); if (s) return cleanFilter(JSON.parse(s)); } catch { /* storage blocked */ }
        return { ...DEFAULT };
    }

    set(change: Partial<DashFilter>) {
        const next = cleanFilter({ ...this.state.value, ...change });
        if (next.period === this.state.value.period && next.compare === this.state.value.compare) return;
        this.state.next(next);
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('period', next.period);
            url.searchParams.set('compare', next.compare);
            window.history.replaceState(window.history.state, '', url.toString());
        } catch { /* the address is left as it was */ }
    }
}
