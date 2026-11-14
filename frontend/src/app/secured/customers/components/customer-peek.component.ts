import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";
import { CustomersService } from "../customers.service";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A customer read beside the list (docs/planning/UI_PATTERNS.md): who they are, where they stand, what they owe, the last months of buying. The full
 * page keeps everything else (account changes, relationship, documents) and Edit. Contact details are masked for a login that may not read them all, the
 * same as on the page: "Show details" opens one customer's details at a time, which is counted and kept.
 */
@Component({
    selector: 'app-customer-peek',
    template: `
    <app-peek [open]="!!id" [title]="customer?.name || 'Customer'" [subtitle]="subtitle" testid="cpeek" [loading]="loading" [error]="error"
      [fullPage]="id ? ['/secure/customers/cust/view', id] : null" (closed)="closed.emit()" (retry)="load()">
      <span badges class="ms-1" *ngIf="profile">
        <span class="badge bg-light text-muted border" *ngIf="profile.status === 'inactive'">Inactive</span>
      </span>
      <a actions class="btn btn-sm btn-outline-primary" *ngIf="customer" [routerLink]="['/secure/customers/cust/edit', id]" data-testid="cpeek-edit">Edit</a>

      <ng-container *ngIf="customer">
        <div class="d-flex flex-wrap gap-2 align-items-center mb-2" *ngIf="profile" data-testid="cpeek-profile">
          <span class="badge bg-light text-dark border">{{profile.segment}}</span>
          <span class="badge" *ngIf="profile.tier" [ngClass]="profile.tier === 'Gold' ? 'bg-warning text-dark' : profile.tier === 'Silver' ? 'bg-secondary' : 'bg-light text-muted border'">{{profile.tier}}</span>
          <span class="badge bg-info text-dark" *ngIf="profile.dueBack">Due back</span>
        </div>
        <div class="small text-muted mb-3" *ngIf="profile && profile.reason">{{profile.reason}}<span *ngIf="profile.spend12"> &middot; {{profile.spend12 | number:'1.0-0'}} spent in the last 12 months</span></div>

        <div class="alert alert-warning py-2 small" *ngIf="dues && dues.balance > 0" data-testid="cpeek-dues">
          Owes <strong>&#8377;{{dues.balance | number:'1.2-2'}}</strong>
          <span *ngIf="dues.overdue && dues.overdue.amount > 0" class="text-danger"> &middot; &#8377;{{dues.overdue.amount | number:'1.2-2'}} overdue</span>
        </div>

        <dl class="row mb-2 small">
          <dt class="col-4">Mobile</dt>
          <dd class="col-8" data-testid="cpeek-mobile">
            {{customer.mobile || '-'}}
            <button type="button" class="btn btn-sm btn-outline-secondary ms-1 py-0" *ngIf="masked && customer.mobile" [disabled]="revealing || limitReached" (click)="reveal()" data-testid="cpeek-reveal">Show details</button>
            <div class="text-muted" *ngIf="masked && privacy && privacy.left !== null">{{privacy.left}} of {{privacy.limit}} left today</div>
            <div class="text-danger" *ngIf="masked && limitReached">Daily limit reached: ask a manager.</div>
          </dd>
          <ng-container *ngIf="customer.altmobile"><dt class="col-4">Alternate</dt><dd class="col-8">{{customer.altmobile}}</dd></ng-container>
          <dt class="col-4">Location</dt><dd class="col-8">{{customer.locality || '-'}}</dd>
          <dt class="col-4">Messages</dt>
          <dd class="col-8" data-testid="cpeek-consent">
            <ng-container *ngIf="customer.doNotContact">Do not contact</ng-container>
            <ng-container *ngIf="!customer.doNotContact">{{customer.consent === 'YES' ? 'Agreed to offers' : customer.consent === 'NO' ? 'Declined offers' : 'Not asked yet'}}</ng-container>
          </dd>
        </dl>
        <div class="text-danger small mb-2" *ngIf="revealError">{{revealError}}</div>

        <app-section title="Also on this number" [count]="others.length" [open]="true" testid="cpeek-household" *ngIf="others.length">
          <div *ngFor="let p of others" class="small"><a href="javascript:void(0)" (click)="select.emit(p.id)" data-testid="cpeek-person">{{p.name}}</a><span class="text-muted" *ngIf="p.relationship"> ({{p.relationship}})</span></div>
        </app-section>

        <app-section title="Recent months" [open]="true" [summary]="months.length ? '' : 'No bills yet'" testid="cpeek-months">
          <div class="text-muted small" *ngIf="!months.length">No bills yet.</div>
          <table class="table table-sm mb-0" *ngIf="months.length" data-testid="cpeek-month-rows">
            <tbody><tr *ngFor="let m of months"><td>{{m.label}}</td><td class="text-end">{{m.count}} bill{{m.count === 1 ? '' : 's'}}</td><td class="text-end">&#8377;{{m.total | number:'1.0-0'}}</td></tr></tbody>
          </table>
        </app-section>
      </ng-container>
    </app-peek>`
})
export class CustomerPeekComponent implements OnChanges {
    /** the customer to show (null = closed) */
    @Input() id: number | null = null;
    @Output() closed = new EventEmitter<void>();
    /** another person on the same number was picked */
    @Output() select = new EventEmitter<number>();

    customer: any = null;
    profile: any = null;
    household: any = null;
    dues: any = null;
    privacy: any = null;
    months: { label: string; count: number; total: number }[] = [];
    loading = false;
    error = '';
    revealed = false;
    revealing = false;
    revealError = '';
    private seq = 0;

    constructor(private service: CustomersService, private http: HttpClient) {}

    get subtitle(): string {
        const c = this.customer;
        if (!c) return '';
        const p = this.profile;
        return [p && p.visitsAll ? `${p.visitsAll} visit${p.visitsAll === 1 ? '' : 's'}` : '', p && p.daysSinceLast != null ? `last ${p.daysSinceLast} day${p.daysSinceLast === 1 ? '' : 's'} ago` : ''].filter(Boolean).join(' · ');
    }
    get others(): any[] { return (this.household?.people || []).filter((p: any) => !p.me); }
    get masked(): boolean { return !!this.customer?.masked && !this.revealed; }
    get limitReached(): boolean { return !!this.privacy && this.privacy.left === 0; }

    ngOnChanges(c: SimpleChanges) { if (c['id']) this.load(); }

    load() {
        const id = this.id;
        this.customer = null; this.profile = null; this.household = null; this.dues = null; this.months = [];
        this.error = ''; this.revealed = false; this.revealError = '';
        if (!id) { this.loading = false; return; }
        // a quick pick of another row while this one is loading must not let the older answer overwrite the newer
        const mine = ++this.seq;
        const live = () => mine === this.seq;
        this.loading = true;
        this.service.find(id).subscribe(
            (c: any) => { if (live()) { this.customer = c; this.loading = false; } },
            () => { if (live()) { this.loading = false; this.error = 'The customer could not be loaded.'; } });
        this.service.profile(id).subscribe((p: any) => { if (live()) this.profile = p; }, () => undefined);
        this.service.household(id).subscribe((h: any) => { if (live()) this.household = h; }, () => undefined);
        this.service.privacy().subscribe((p: any) => { if (live()) this.privacy = p; }, () => undefined);
        this.http.get<any>(`${environment.apiHost}/customer-dues/${id}`).subscribe((d: any) => { if (live()) this.dues = d; }, () => undefined);
        this.service.getCustomerOrderedMonths({ id }).subscribe((rows: any[]) => {
            if (live()) this.months = (rows || []).slice(0, 3).map((r: any) => ({ label: `${MONTHS[r.mon - 1] || r.mon} ${r.yr}`, count: r.count, total: r.total }));
        }, () => undefined);
    }

    reveal() {
        if (!this.id) return;
        this.revealError = '';
        this.revealing = true;
        const mine = this.seq;
        this.service.reveal(this.id).subscribe((d: any) => {
            if (mine !== this.seq) return;
            this.customer = { ...this.customer, ...d, masked: false };
            this.revealed = true; this.revealing = false;
            this.service.privacy().subscribe((p: any) => { if (mine === this.seq) this.privacy = p; }, () => undefined);
        }, (e: any) => { this.revealing = false; this.revealError = e?.error?.message || 'Could not show the details.'; });
    }
}
