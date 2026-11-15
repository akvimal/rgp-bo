import { Injectable } from "@angular/core";
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { NavigationStart, Router } from "@angular/router";
import { Observable } from "rxjs";
import { filter, takeUntil } from "rxjs/operators";

/** the dashboard's figures: slow to work out, useless once the person has left the page */
const CANCELLABLE = /\/dashboard\/(?!view)/;

/**
 * Stops the dashboard's requests that are still waiting when the person goes to another page. A browser allows only a few connections at a time to one
 * server, so ten slow dashboard reads still running would make the next page wait behind them. Cancelling the request frees the connection at once
 * (the browser sends nothing more and the server's reply is dropped). Only GET requests of the dashboard are cancelled; nothing that saves is ever cancelled.
 */
@Injectable()
export class CancelOnNavigateInterceptor implements HttpInterceptor {
    constructor(private router: Router) {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (req.method !== 'GET' || !CANCELLABLE.test(req.url)) return next.handle(req);
        return next.handle(req).pipe(takeUntil(this.router.events.pipe(filter((e) => e instanceof NavigationStart && e.url.split('?')[0] !== this.router.url.split('?')[0]))));
    }
}
