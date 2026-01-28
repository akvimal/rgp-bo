import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { DateUtilService } from "src/app/secured/date-util.service";
import { ProductsService } from "../../products.service";

@Component({
    selector: 'app-product-price-change',
    templateUrl: 'product-price-change.component.html'
})
export class ProductPriceChangeComponent {

    @Input() productid;
    @Output() added = new EventEmitter();

    empty = { sale: 0, date: '', reason: '', comments: '' };
    price:any;
    current:any = {};
    showBreakdown = false; // Control pricing breakdown visibility

    /**
     * Configurable thresholds based on business operations, product category, and market strategy.
     *
     * PHARMACY INDUSTRY STANDARDS:
     * - Generic Medicines: 50-80% margin (high competition, volume-based)
     * - Branded Medicines: 10-30% margin (regulated pricing, lower margins)
     * - OTC Products: 30-50% margin (balance of volume and margin)
     * - Premium/Specialty: 40-60% margin (low volume, high margin)
     *
     * PRICING STRATEGY CONSIDERATIONS:
     * - High Demand + Low Competition = Higher margins (40-60%)
     * - Low Demand + High Competition = Lower margins (10-20%)
     * - Seasonal/Promotional = Flexible discounts (15-40%)
     * - Fast-moving generics = Volume-based margins (50-80%)
     *
     * CUSTOMIZATION BY PRODUCT CATEGORY:
     * To customize for specific products, these values can be set dynamically
     * based on product.category or product.type in the parent component.
     *
     * Example: if (product.category === 'GENERIC') {
     *   this.marginThresholds = { good: 60, acceptable: 40 };
     * }
     */
    marginThresholds = {
        good: 25,      // >= 25% profit margin (green) - default for mixed inventory
        acceptable: 15 // >= 15% profit margin (yellow), < 15% is low (red)
    };

    discountThresholds = {
        high: 20,      // >= 20% discount (red - aggressive pricing, may hurt brand)
        medium: 10     // >= 10% discount (yellow - moderate), < 10% is low (blue - premium)
    };

    constructor(private service:ProductsService, private dateService:DateUtilService){}

    ngOnChanges(changes:SimpleChanges){
        // console.log(changes.productid);
        if(changes.productid.currentValue > 0){
            this.service.findPricesById(changes.productid.currentValue).subscribe(data => {
                this.price = this.empty;
                this.price['sale'] = data['price']['price'];
                this.current = data;
            });
        }
    }

    ngOnInit(){
        this.price = this.empty;
        this.price['date'] = this.dateService.getFormatDate(new Date());
    }

    onSave(){
        this.service.addPrice({id:this.productid, ...this.price}).subscribe(data => {            
            this.added.emit(data);
        });
    }

    calculate(event:any){
        const price = +event.target.value;

        const ptr = +this.current.price.ptr;
        const mrp = +this.current.price.mrp;

        if(price > mrp){
            event.target.value = mrp;
            this.price.sale = mrp;
        }
        if(price < ptr){
            event.target.value = ptr;
            this.price.sale = ptr;
        }

        const margin = ((price-ptr)/ptr) * 100;
        const discount = ((mrp-price)/mrp) * 100;
        console.log(margin,discount);
        this.current.price.margin = Math.round(margin);
        this.current.price.discount = Math.round(discount);
        console.log(this.current);

    }

    onPriceSliderChange(event: any) {
        const price = +event.target.value;
        this.price.sale = price;

        const ptr = +this.current.price.ptr;
        const mrp = +this.current.price.mrp;

        const margin = ((price-ptr)/ptr) * 100;
        const discount = ((mrp-price)/mrp) * 100;

        this.current.price.margin = Math.round(margin);
        this.current.price.discount = Math.round(discount);
    }

    priceData(event:any){
        this.price.sale = event.price;
    }

    isValid(){
        return this.price.sale != '' && this.price.date != null
        && this.price.reason != '';
    }

    getMarginClass(margin: number): string {
        if (margin >= this.marginThresholds.good) return 'text-success';
        if (margin >= this.marginThresholds.acceptable) return 'text-warning';
        return 'text-danger';
    }

    getDiscountClass(discount: number): string {
        if (discount >= this.discountThresholds.high) return 'text-danger';
        if (discount >= this.discountThresholds.medium) return 'text-warning';
        return 'text-primary';
    }
}