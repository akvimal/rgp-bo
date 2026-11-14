import { Injectable } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { BehaviorSubject, Observable } from "rxjs";
import { distinctUntilChanged, filter } from "rxjs/operators";

/** the peek id in an address ("/secure/customers/cust/list?peek=12" gives "12"), or null; anything that is not a plain id is ignored */
export function peekFrom(url: string): string | null {
    const q = url.split('#')[0].split('?')[1] || '';
    const v = new URLSearchParams(q).get('peek');
    return v && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null;
}

/**
 * Keeps the open peek panel in the page address (`?peek=12`): Back closes the panel instead of leaving the list, and a link opens the list with the
 * panel already open (docs/planning/UI_PATTERNS.md). A list calls `open(id)` and `close()` and reads `peek$`; nothing else about its address changes.
 */
@Injectable({ providedIn: 'root' })
export class PeekAddressService {
    private readonly state: BehaviorSubject<string | null>;
    readonly peek$: Observable<string | null>;

    constructor(private router: Router) {
        this.state = new BehaviorSubject<string | null>(peekFrom(router.url));
        this.peek$ = this.state.pipe(distinctUntilChanged());
        router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.state.next(peekFrom(router.url)));
    }

    get current(): string | null { return this.state.value; }

    /** opens a panel; one history entry is added, so Back closes it */
    open(id: string | number) {
        this.router.navigate([], { queryParams: { peek: id }, queryParamsHandling: 'merge' });
    }

    /** closes the panel without leaving an extra step in the history */
    close() {
        if (this.state.value === null) return;
        this.router.navigate([], { queryParams: { peek: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
}
