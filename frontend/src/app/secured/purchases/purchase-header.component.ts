import { Component } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";

@Component({
    selector: 'app-purchase-header',
    templateUrl: './purchase-header.component.html'
})
export class PurchaseHeaderComponent {
    constructor(public auth: AuthService) {}
}