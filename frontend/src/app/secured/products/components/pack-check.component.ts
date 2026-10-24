import { Component, OnInit } from "@angular/core";
import { ProductsService } from "../products.service";

/**
 * Products whose pack size or unit looks wrong. A wrong pack makes the cost per unit wrong, so margins, rate checks and
 * "sold below cost" figures are wrong too. Each row says why it was flagged and links to the product to correct the pack.
 */
@Component({
    templateUrl: './pack-check.component.html'
})
export class PackCheckComponent implements OnInit {

    rows: any[] = [];
    loading = true;
    error = '';

    readonly why: { [code: string]: string } = {
        UNIT_JUMP: 'MRP changed by a large factor between two purchases (a box one time, single pieces the next)',
        COST_OVER_MRP: 'The latest purchase rate with GST is above its MRP',
        PRICE_OVER_MRP: 'The sale price with GST is above the MRP',
        PRICE_FAR_BELOW_MRP: 'The sale price is under 5% of the MRP',
    };

    constructor(private service: ProductsService) {}

    ngOnInit() {
        this.service.packCheck().subscribe(
            (r: any[]) => { this.rows = r || []; this.loading = false; },
            (err: any) => { this.loading = false; this.error = err?.error?.message || 'Could not load the pack check.'; });
    }
}
