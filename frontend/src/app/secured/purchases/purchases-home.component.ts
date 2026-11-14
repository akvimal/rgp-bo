import { Component } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";

@Component({
    template: `
    <div class="page-head" *ngIf="showPurchaseHeader">
        <h1>Purchase</h1>
        <app-purchase-header></app-purchase-header>
    </div>
    <router-outlet></router-outlet>
    `
})
export class PurchaseHomeComponent {
    showPurchaseHeader = true;

    constructor(private router: Router) {}

    ngOnInit() {
        this.updateShell(this.router.url);
        this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
            this.updateShell(event.urlAfterRedirects || event.url);
        });
    }

    private updateShell(url: string) {
        this.showPurchaseHeader = true;   // Vendors is a tab of Purchase now, so the tab bar stays
    }
}
