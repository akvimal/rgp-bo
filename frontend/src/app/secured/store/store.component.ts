import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { StoreContextService } from "src/app/@core/store-context.service";
import { AuthService } from "src/app/@core/auth/auth.service";
import { PurchaseIntentService } from "./intent/purchase-intent.service";
import { StockService } from "./stock/stock.service";

@Component({
    template: `
        <div class="page-head">
            <h1>Store</h1>
            <nav class="page-menu navbar navbar-light bg-light non-print m-0 p-0">
                <ul class="nav">
                    <li class="nav-item" *isNavAuth>
                        <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="stock">Stock</a>
                    </li>
                    <li class="nav-item" *isNavAuth>
                        <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="shifts">Shifts</a>
                    </li>
                    <ng-container *ngIf="transfersOn">
                        <li class="nav-item" *isNavAuth>
                            <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="transfers" data-testid="store-tab-transfers">Transfers</a>
                        </li>
                    </ng-container>
                    <li class="nav-item" *isNavAuth>
                        <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="cash">Cash</a>
                    </li>
                    <li class="nav-item" *ngIf="vaultOn">
                        <a class="nav-link" [routerLinkActive]="['is-active']" routerLink="vault" data-testid="store-tab-vault">Vault</a>
                    </li>
                </ul>
            </nav>
            <div class="page-head-actions">
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
        <router-outlet></router-outlet>
`,
    styles: [`
        .tile { cursor:pointer; font-size:.85em; padding:.2em .6em; border-radius:.35em; }
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
    /** stock moves between stores: the Transfers tab shows only when the business has transfers switched on and more than one store to move between */
    transfersOn = false;
    private subs = new Subscription();

    constructor(private intentService: PurchaseIntentService, private stockService: StockService, private router: Router, private storeContext: StoreContextService, private auth: AuthService) {}

    ngOnDestroy(): void { this.subs.unsubscribe(); }

    private syncTransfers() {
        this.transfersOn = this.storeContext.stores.length > 1 && this.auth.moduleOn('transfers');
    }

    private syncVault() {
        const id = this.storeContext.effectiveStoreId();
        const store = this.storeContext.stores.find((s: any) => Number(s.id) === id);
        this.vaultOn = !!store?.vaultenabled && this.auth.isUrlAuthorized('/secure/store/vault');
    }

    ngOnInit(): void {
        this.subs.add(this.storeContext.stores$.subscribe(() => { this.syncVault(); this.syncTransfers(); }));
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
