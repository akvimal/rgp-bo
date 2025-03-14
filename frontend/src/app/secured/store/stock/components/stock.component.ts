import { Component } from "@angular/core";

@Component({
    template: `
    <nav class="navbar navbar-light bg-light justify-content-between m-0 p-0">
        <ul class="nav">
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="products">Products</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="expiry">Expiry</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="adjust">Adjustments</a>
            </li>
        </ul>
    </nav>
    <router-outlet></router-outlet>`
})
export class StockComponent {}