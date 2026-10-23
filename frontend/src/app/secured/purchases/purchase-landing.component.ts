import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../../@core/auth/auth.service";

/** The Purchase menu opens on Orders; a person who may not use it goes to the part of Purchase they may (invoices, or their own requests). */
@Component({ template: '' })
export class PurchaseLandingComponent {
    constructor(auth: AuthService, router: Router) {
        const target = auth.purchasingFull && auth.isActionAuthorized('purchases.add') ? 'orders'
            : auth.isActionAuthorized('purchases.add') ? 'invoices'
            : 'my-requests';
        router.navigate(['/secure/purchases', target], { replaceUrl: true });
    }
}
