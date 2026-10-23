import { Component } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";

/**
 * Landing screen for "what to buy / what's on order": the tabs read Requests, Reorder, Orders; Requests is the one that opens first (Reorder keeps its own address, /suggestions).
 * a buyer sees demand signals first, not an empty order list. Orders + Requests are folded in as
 * tabs rather than separate nav items (PURCHASE_ORDER_REVAMP.md, phase 6a). Opening a specific PO
 * (/orders/:id) forces the Orders tab so the master/detail split is visible.
 */
const TAB_INDEX: { [key: string]: number } = { requests: 0, reorder: 1, orders: 2 };

@Component({
    templateUrl: './purchase-orders-home.component.html'
})
export class PurchaseOrdersHomeComponent {

    activeIndex = TAB_INDEX['requests'];

    constructor(private route: ActivatedRoute, private router: Router) {}

    ngOnInit() {
        this.applyTabFromRoute();
        this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.applyTabFromRoute());
    }

    private applyTabFromRoute() {
        const hasOrderDetail = !!this.route.snapshot.firstChild;
        const tab = this.route.snapshot.data?.tab || 'requests';
        // closing an open order lands on /orders: stay on the Orders tab you were on, rather than falling back to Requests
        const closedOrder = !hasOrderDetail && this.activeIndex === TAB_INDEX['orders'] && /\/purchases\/orders\/?$/.test(this.router.url);
        this.activeIndex = hasOrderDetail || closedOrder ? TAB_INDEX['orders'] : (TAB_INDEX[tab] ?? TAB_INDEX['requests']);
    }
}
