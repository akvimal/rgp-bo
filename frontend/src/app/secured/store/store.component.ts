import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { AuthService } from "src/app/@core/auth/auth.service";
import { PurchaseIntentService } from "./intent/purchase-intent.service";
import { StockService } from "./stock/stock.service";

@Component({
    template: `
        <div class="pagetitle d-flex justify-content-between align-items-center">
            <h1>Store</h1>
            <div class="d-flex">
                <div class="tile expiry-tile" *ngIf="nearExpiryCount > 0" (click)="goToExpiry()" role="button">
                    <i class="bi bi-hourglass-split text-danger"></i>
                    {{nearExpiryCount}} item{{nearExpiryCount === 1 ? '' : 's'}} expiring within {{expiryDays}} days
                </div>
                <div class="tile reorder-tile" *ngIf="reorderCount > 0" (click)="goToReorder()" role="button">
                    <i class="bi bi-exclamation-triangle-fill text-warning"></i>
                    {{reorderCount}} product{{reorderCount === 1 ? '' : 's'}} need reordering
                </div>
            </div>
        </div>
        <nav class="page-menu navbar navbar-light bg-light justify-content-between non-print m-0 p-0">
            <ul class="nav">
                <li class="nav-item" *isNavAuth>
                    <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="stock">Stock</a>
                </li>
                <li class="nav-item" *isNavAuth>
                    <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="shifts">Shifts</a>
                </li>
                <li class="nav-item" *isNavAuth>
                    <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="transfers">Transfers</a>
                </li>
                <li class="nav-item" *isNavAuth>
                    <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="cash">Cash</a>
                </li>
                <li class="nav-item" *ngIf="vaultOn">
                    <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="vault" data-testid="store-tab-vault">Vault</a>
                </li>
            </ul>
        </nav>
        <router-outlet></router-outlet>
`,
    styles: [`
        .tile { cursor:pointer; font-size:.95em; padding:.35em .75em; border-radius:.35em; margin-left:.5em; }
        .reorder-tile { border:1px solid #f0c36d; background:#fff8e6; }
        .reorder-tile:hover { background:#fdedc8; }
        .expiry-tile { border:1px solid #f0a3a3; background:#fff0f0; }
        .expiry-tile:hover { background:#ffdede; }
    `]
})
export class StoreComponent implements OnInit, OnDestroy {

    reorderCount = 0;
    nearExpiryCount = 0;
    expiryDays = 30;

    /** the selected store keeps a vault: the Vault tab shows only then */
    vaultOn = false;
    private subs = new Subscription();

    constructor(private intentService: PurchaseIntentService, private stockService: StockService, private router: Router, private storeContext: StoreContextService, private auth: AuthService) {}

    ngOnDestroy(): void { this.subs.unsubscribe(); }

    private syncVault() {
        const id = this.storeContext.selectedStoreId;
        const store = this.storeContext.stores.find((s: any) => s.id === id);
        this.vaultOn = !!store?.vaultenabled && this.auth.isUrlAuthorized('/secure/store/vault');
    }

    ngOnInit(): void {
        this.subs.add(this.storeContext.stores$.subscribe(() => this.syncVault()));
        this.subs.add(this.storeContext.selectedStoreId$.subscribe(() => this.syncVault()));
        this.intentService.findSuggestions({}).subscribe((data: any) => {
            this.reorderCount = (data || []).filter((row: any) => +row.final_qty > 0).length;
        }, () => this.reorderCount = 0);

        this.stockService.getNearExpiryCount().subscribe((data: any) => {
            this.nearExpiryCount = +(data?.count || 0);
            this.expiryDays = +(data?.days || 30);
        }, () => this.nearExpiryCount = 0);
    }

    goToReorder() {
        this.router.navigateByUrl('/secure/purchases/orders');
    }

    goToExpiry() {
        this.router.navigateByUrl('/secure/store/stock/expiry');
    }
}
