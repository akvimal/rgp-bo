import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { debounce, distinctUntilChanged, map } from 'rxjs/operators';
import { timer } from 'rxjs';

/**
 * Whether the app is busy bringing something up: a page being opened or a request still waiting. The top bar listens to this.
 * It shows only after a short wait, so quick pages do not flicker, and once shown it stays a moment so it is seen.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
    private requests = 0;
    private navigating = false;
    private state = new BehaviorSubject<boolean>(false);

    /** true while busy, after a 200 ms wait before showing and a short hold before hiding */
    readonly busy$: Observable<boolean> = this.state.pipe(
        distinctUntilChanged(),
        debounce((b) => timer(b ? 200 : 250)),
        distinctUntilChanged());

    requestStarted() { this.requests++; this.publish(); }
    requestEnded() { this.requests = Math.max(0, this.requests - 1); this.publish(); }
    navigation(on: boolean) { this.navigating = on; this.publish(); }
    private publish() { this.state.next(this.requests > 0 || this.navigating); }
}
