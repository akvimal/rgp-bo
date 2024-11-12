import { Component } from "@angular/core";
import { SaleService } from "../sales.service";

@Component({
    template: `
        <app-sale-header></app-sale-header>
        <nav class="navbar navbar-light bg-light justify-content-between non-print m-0 p-0">
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

    constructor(private service:SaleService){
        this.service.refreshSavedSales();
    }
    
    ngOnInit(){
        this.service.saved.subscribe((data:any) => {
            this.saved = data;
        });
    }
}