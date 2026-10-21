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
    get typed(): number { return +this.price.sale || 0; }
    get cappedAt(): number | null { return this.mrp && this.typed > this.mrp ? this.mrp : null; }
    get effective(): number { return this.cappedAt ?? this.typed; }
    get margin(): number | null { return this.ptr && this.typed > 0 ? Math.round((this.effective - this.ptr) / this.ptr * 100) : null; }
    get discount(): number | null { return this.mrp && this.typed > 0 ? Math.round((this.mrp - this.effective) / this.mrp * 100) : null; }
    get tooHigh(): boolean { return this.margin !== null && this.margin > MARGIN_LIMIT; }
    get high(): boolean { return this.margin !== null && this.margin > MARGIN_WARN && !this.tooHigh; }
    get belowCost(): boolean { return this.ptr > 0 && this.typed > 0 && this.effective < this.ptr; }

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
        });
    }
}
