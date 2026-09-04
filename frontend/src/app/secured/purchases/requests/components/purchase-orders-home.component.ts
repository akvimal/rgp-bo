import { Component } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";

/**
 * Landing screen for "what to buy / what's on order": Reorder (suggestions) is the default tab so
 * a buyer sees demand signals first, not an empty order list. Orders + Requests are folded in as
 * tabs rather than separate nav items (PURCHASE_ORDER_REVAMP.md, phase 6a). Opening a specific PO
 * (/orders/:id) forces the Orders tab so the master/detail split is visible.
 */
const TAB_INDEX: { [key: string]: number } = { reorder: 0, orders: 1, requests: 2 };

@Component({
    templateUrl: './purchase-orders-home.component.html'
})
export class PurchaseOrdersHomeComponent {

    activeIndex = 0;

    constructor(private route: ActivatedRoute, private router: Router) {}

    ngOnInit() {
        this.applyTabFromRoute();
        this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.applyTabFromRoute());
    }

    private applyTabFromRoute() {
        const hasOrderDetail = !!this.route.snapshot.firstChild;
        const tab = this.route.snapshot.data?.tab || 'reorder';
        this.activeIndex = hasOrderDetail ? TAB_INDEX['orders'] : (TAB_INDEX[tab] ?? 0);
    }
}
