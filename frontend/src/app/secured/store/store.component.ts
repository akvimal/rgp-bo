import { Component } from "@angular/core";

@Component({
    template: `
        <div class="pagetitle">
            <h1>Store</h1>
        </div>
        <nav class="page-menu navbar navbar-light bg-light justify-content-between non-print m-0 p-0">
            <ul class="nav">
            <li class="nav-item" *isNavAuth>
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="/secure/store/stock">Stock</a>
            </li>
            <li class="nav-item" *isNavAuth>
                <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="/secure/store/cash">Cash</a>
            </li>
            </ul>
        </nav>
        <router-outlet></router-outlet>
`
})
export class StoreComponent {}