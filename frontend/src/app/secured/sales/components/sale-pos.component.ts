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
                <li class="nav-item" *ngFor="let s of saved">
                    <a class="nav-link" [routerLinkActive]="['is-active']" [routerLink]="['/secure/sales/pos/edit',s.id]">{{s.name !== null ? s.name : s.bill_no}}</a>
                </li>
            </ul>
        </nav>
        <router-outlet></router-outlet>`
})
export class SalePosComponent {
    
    saved:{id:number,bill_no:'',name:'',mobile:'',created_on:''}[] = []

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