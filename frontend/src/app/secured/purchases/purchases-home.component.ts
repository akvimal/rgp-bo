import { Component } from "@angular/core";

@Component({
    template: `
    <div class="pagetitle">
        <h1>Purchase</h1>
    </div>
    <app-purchase-header></app-purchase-header>
    <router-outlet></router-outlet>
    `
})
export class PurchaseHomeComponent{}