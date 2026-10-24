import { Component } from "@angular/core";
import { ProductPrice } from "../../product-price.model";
import { ProductsService } from "../../products.service";

@Component({
    templateUrl: 'product-price.component.html'
})
export class ProductPriceComponent {

    criteria = {active:true,title:''}
    productid=0;

    products:any[] = [];
    flagFilter = '';
    message = '';
    showPriceChange:boolean = false;

    constructor(private service:ProductsService){}

    ngOnInit(){
       this.filter();
    }

    filter(){
        this.service.findAllPrices(this.criteria).subscribe((data:any)=> this.products = data);
    }

    onRowEditInit(product: ProductPrice) {
    //  console.log('onRowEditInit',product);
    }

    onRowEditSave(product: ProductPrice) {
        console.log('onRowEditSave',product);
        if(product['price_id']){ //update price
            console.log('update price');
            this.service.updatePrice(product).subscribe(data => {
                console.log(data);
            })
        }
        else { //add new price to the rpduct
            console.log('add price');
            this.service.addPrice(product).subscribe(data => {
                console.log(data);
            })
        }
    }

    onRowEditCancel(product: ProductPrice, index: number) {
        // console.log('onRowEditCancel',product);
        // console.log('index: ',index); 
    }

    changePrice(productid:number){
        this.productid=productid;
        this.showPriceChange = true;
    }

    changed(event:any){
        this.showPriceChange = false;
        const notes: string[] = [];
        if (event?.capped) notes.push(`capped at ${event.ceiling} (the MRP ${event.mrp} less GST)`);
        for (const w of event?.warnings || []) notes.push(w);
        this.message = `Price saved at ${event?.saleprice ?? ''}${notes.length ? ': ' + notes.join(' ') : '.'}`;
        this.filter();
    }

    /** what is wrong with a row, if anything: the same limits the API enforces */
    flagsOf(p:any): string[] {
        const f: string[] = [];
        const price = +p.price || 0, mrp = +p.mrp || 0, ptr = +p.ptr || 0;
        const billed = price * (1 + (+(p.sale_tax ?? p.tax) || 0) / 100), atCost = price * (1 + (+p.tax || 0) / 100);
        if (!price) f.push('none');
        if (price && mrp && Math.round(billed * 100) > Math.round(mrp * 100) + 1) f.push('above');
        if (price && ptr && Math.round(atCost * 100) < Math.round(ptr * 100)) f.push('below');
        if (ptr && (+p.margin || 0) > 300) f.push('high');
        return f;
    }

    get visible(): any[] {
        return this.flagFilter ? this.products.filter(p => this.flagsOf(p).includes(this.flagFilter)) : this.products;
    }
}