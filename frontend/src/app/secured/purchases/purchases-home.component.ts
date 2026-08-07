import { Component } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";

@Component({
    template: `
    <div class="pagetitle">
        <h1 *ngIf="showPurchaseHeader">Purchase</h1>
    </div>
    <app-purchase-header *ngIf="showPurchaseHeader"></app-purchase-header>
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
        this.showPurchaseHeader = !url.includes('/purchases/vendors');
    }
}
