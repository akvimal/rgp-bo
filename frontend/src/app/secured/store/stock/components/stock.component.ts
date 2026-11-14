import { Component } from "@angular/core";

@Component({
    template: `
    <nav class="sub-tabs navbar navbar-light bg-light justify-content-between m-0 p-0">
        <ul class="nav">
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="products">Products</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="expiry">Expiry</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="passes" data-testid="stock-tab-passes">Out-passes</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="writeoffs" data-testid="stock-tab-writeoffs">Write-offs</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="adjust">Adjustments</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="count">Count</a>
            </li>
        </ul>
    </nav>
    <router-outlet></router-outlet>`
})
export class StockComponent {}