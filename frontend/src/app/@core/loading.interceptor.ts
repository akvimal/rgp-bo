import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../shared/loading.service';

/** requests the app makes by itself on a timer: they must not make the loading bar flash */
const BACKGROUND = /\/alerts\/notifications|\/alerts\/prefs|\/auth\/refresh|\/quick-actions|\/shifts?\/current/;

/** counts the requests still waiting, for the loading bar */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
    constructor(private loading: LoadingService) {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (req.method === 'GET' && BACKGROUND.test(req.url)) return next.handle(req);
        this.loading.requestStarted();
        return next.handle(req).pipe(finalize(() => this.loading.requestEnded()));
    }
}
