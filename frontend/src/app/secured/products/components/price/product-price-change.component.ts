import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { DateUtilService } from "src/app/secured/date-util.service";
import { ProductsService } from "../../products.service";

const MARGIN_WARN = 300;     // above this the price is saved with a warning
const MARGIN_LIMIT = 1000;   // above this it is refused as a typing mistake

@Component({
    selector: 'app-product-price-change',
    templateUrl: 'product-price-change.component.html'
})
export class ProductPriceChangeComponent {

    @Input() productid;
    @Output() added = new EventEmitter();

    price:any = { sale: '', date: '', reason: '', comments: '' };
    current:any = {};
    saving = false;
    error = '';
    /** the price breaks the pricing policy: a Store Head or Business Head may set it anyway, with a reason */
    needsOverride = false;

    constructor(private service:ProductsService, private dateService:DateUtilService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.productid && changes.productid.currentValue > 0){
            this.error = '';
            this.service.findPricesById(changes.productid.currentValue).subscribe((data:any) => {
                this.current = data || {};
                this.price = { sale: data?.price?.price ?? '', date: this.dateService.getFormatDate(new Date()), reason: '', comments: '' };
            });
        }
    }

    ngOnInit(){
        this.price.date = this.dateService.getFormatDate(new Date());
    }

    /** the purchase cost and MRP the price is checked against (none until the product has been bought) */
    get ptr(): number { return +(this.current?.price?.ptr || 0); }
    get mrp(): number { return +(this.current?.price?.mrp || 0); }
    /** the GST the till bills (at most 5% since GST 2.0), and the GST the purchase batch carries (its cost includes that) */
    get saleTax(): number { return +(this.current?.price?.sale_tax ?? this.current?.price?.tax ?? 0); }
    get batchTax(): number { return +(this.current?.price?.tax || 0); }
    /** the price is without GST and the bill adds GST, so the most it can be is the MRP less the GST billed */
    get ceiling(): number { return this.mrp ? Math.floor(this.mrp / (1 + this.saleTax / 100) * 100 + 1e-6) / 100 : 0; }
    get typed(): number { return +this.price.sale || 0; }
    get cappedAt(): number | null { return this.ceiling && this.typed > this.ceiling ? this.ceiling : null; }
    get effective(): number { return this.cappedAt ?? this.typed; }
    /** margin and discount compare like with like: the price with GST against the cost and the MRP, both with GST */
    get withGst(): number { return this.effective * (1 + this.saleTax / 100); }
    get margin(): number | null { return this.ptr && this.typed > 0 ? Math.round((this.effective * (1 + this.batchTax / 100) - this.ptr) / this.ptr * 100) : null; }
    get discount(): number | null { return this.mrp && this.typed > 0 ? Math.round((this.mrp - this.withGst) / this.mrp * 100) : null; }
    get tooHigh(): boolean { return this.margin !== null && this.margin > MARGIN_LIMIT; }
    get high(): boolean { return this.margin !== null && this.margin > MARGIN_WARN && !this.tooHigh; }
    get belowCost(): boolean { return this.ptr > 0 && this.typed > 0 && this.effective * (1 + this.batchTax / 100) < this.ptr; }

    isValid(){
        return this.typed > 0 && !!this.price.date && !!this.price.reason && !this.tooHigh && !this.saving;
    }

    onSave(){
        this.error = '';
        this.saving = true;
        this.service.addPrice({id:this.productid, ...this.price}).subscribe((data:any) => {
            this.saving = false;
            this.added.emit(data);
        }, err => {
            this.saving = false;
            const m = err?.error?.message;
            this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not save the price.');
            this.needsOverride = err?.status === 400 && /overridereason/.test(this.error);
        });
    }
}
