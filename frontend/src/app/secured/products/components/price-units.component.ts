import { Component } from "@angular/core";

/**
 * The one sentence that every price screen needs: what the numbers are per, and what markup and discount mean. A price is per pack and
 * without GST; the MRP has GST in it; the product list, the Price page, the pricing policy and the pack check all show the same units.
 */
@Component({
    selector: 'app-price-units',
    template: `<p class="small text-muted mb-2" data-testid="price-units">Prices and costs are per pack, before GST; the MRP includes GST.
        <b>Markup</b> is how far the price is above the cost. <b>Discount</b> is how far the price with GST is below the MRP.</p>`
})
export class PriceUnitsComponent {}
