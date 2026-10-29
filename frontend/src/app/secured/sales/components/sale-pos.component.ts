import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { SaleService } from "../sales.service";

@Component({
    template: `
        <app-sale-header></app-sale-header>
        <nav class="navbar navbar-light bg-light justify-content-between non-print m-0 p-0 mt-2" *ngIf="saved.length > 0 || !onNew" data-testid="sale-tabs">
            <ul class="nav">
                <li class="nav-item">
                    <a class="nav-link" [routerLinkActive]="['is-active']" [routerLink]="['/secure/sales/pos/new']">
                       <span> New Sale </span>
                    </a>
                </li>
                <li class="nav-item" *ngFor="let s of shown">
                    <a class="nav-link" [routerLinkActive]="['is-active']" [routerLink]="['/secure/sales/pos/edit',s.id]" data-testid="sale-tab">{{s.name !== null ? s.name : s.bill_no}}</a>
                </li>
                <li class="nav-item d-flex align-items-center ms-2" *ngIf="more.length">
                    <select class="form-select form-select-sm" aria-label="More saved sales" data-testid="sale-more" (change)="openMore($any($event.target))">
                        <option value="">More saved ({{more.length}})</option>
                        <option *ngFor="let s of more" [value]="s.id">{{s.name !== null ? s.name : s.bill_no}}</option>
                    </select>
                </li>
            </ul>
        </nav>
        <router-outlet></router-outlet>`
})
export class SalePosComponent {
    
    saved:{id:number,bill_no:'',name:'',mobile:'',created_on:''}[] = []

    /** at most this many saved sales are tabs; the rest are in the "More saved" list, so the row never fills the screen */
    readonly maxTabs = 5;

    /** the sale open now stays a tab even when it is an older one */
    private get openId(): number | null {
        const m = /\/pos\/edit\/(\d+)/.exec(this.router.url);
        return m ? Number(m[1]) : null;
    }
    get shown() {
        const first = this.saved.slice(0, this.maxTabs);
        const open = this.openId;
        if (open !== null && !first.some((s) => Number(s.id) === open)) {
            const current = this.saved.find((s) => Number(s.id) === open);
            if (current) return [...first.slice(0, this.maxTabs - 1), current];
        }
        return first;
    }
    get more() {
        const shownIds = new Set(this.shown.map((s) => Number(s.id)));
        return this.saved.filter((s) => !shownIds.has(Number(s.id)));
    }
    openMore(select: HTMLSelectElement) {
        if (select.value) this.router.navigate(['/secure/sales/pos/edit', select.value]);
        select.value = '';
    }

    /** the blank bill is the only thing on the page: nothing to switch to, so no tab row */
    get onNew(): boolean { return this.router.url.split('?')[0].endsWith('/pos/new'); }

    constructor(private service:SaleService, private router:Router){
        this.service.refreshSavedSales();
    }
    
    ngOnInit(){
        this.service.saved.subscribe((data:any) => {
            this.saved = data;
        });
    }
}