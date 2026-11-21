import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "src/app/@core/auth/auth.service";

/**
 * Pricing: the prices of what the shop sells and the rules they follow. Prices, the changes sheet, the pricing policy and the pricing rules are its
 * pages (they were under Products and, for the changes sheet, a menu entry of its own). Offers and sales will join them here.
 */
@Component({
    template: `
    <div class="page-head">
      <h1>Pricing</h1>
      <nav class="navbar navbar-light bg-light non-print m-0 p-0">
        <ul class="nav">
          <li class="nav-item" [routerLinkActive]="['is-active']" *isAuth="'products.price'">
            <a class="nav-link" routerLink="/secure/pricing/prices" data-testid="nav-prices">Prices</a>
          </li>
          <li class="nav-item" [routerLinkActive]="['is-active']" *isAuth="'pricechanges.view'">
            <a class="nav-link" routerLink="/secure/pricing/changes" data-testid="nav-changes">Price changes</a>
          </li>
          <li class="nav-item" [routerLinkActive]="['is-active']" *isAuth="'products.price'">
            <a class="nav-link" routerLink="/secure/pricing/policy" data-testid="nav-policy">Pricing policy</a>
          </li>
          <li class="nav-item" [routerLinkActive]="['is-active']" *isAuth="'products.price'">
            <a class="nav-link" routerLink="/secure/pricing/rules" data-testid="nav-rules">Pricing rules</a>
          </li>
          <li class="nav-item" [routerLinkActive]="['is-active']" *isAuth="'products.price'">
            <a class="nav-link" routerLink="/secure/pricing/compare" data-testid="nav-compare">Price comparison</a>
          </li>
        </ul>
      </nav>
    </div>
    <router-outlet></router-outlet>
    `
})
export class PricingComponent implements OnInit {
    constructor(private router: Router, private auth: AuthService) {}

    /** /secure/pricing itself opens the first page the role may see: the prices, or (a counter role) the changes sheet */
    ngOnInit() {
        if (this.router.url.split(/[?#]/)[0].replace(/\/$/, '') !== '/secure/pricing') return;
        this.router.navigateByUrl(this.auth.isUrlAuthorized('/secure/pricing/prices') ? '/secure/pricing/prices' : '/secure/pricing/changes', { replaceUrl: true });
    }
}
