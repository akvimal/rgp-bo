import { Component, EventEmitter, Output } from "@angular/core";
import { ProductsService } from "src/app/secured/products/products.service";

@Component({
    selector: 'app-product-select',
    template: `
        <p-autoComplete 
        (onSelect)="doneSelect($event)" 
        field="''"
        placeholder="Name / Composition" 
        [suggestions]="filteredProducts" 
        [minLength]="2"
        (completeMethod)="filterProduct($event)" 
        [showEmptyMessage]="true"
        [inputStyle]="{'background-color':'#9df'}">
            <ng-template let-product pTemplate="item">
                <div>
                    <h6 style="margin:0;padding:0;font-weight:bold">{{product.title}}</h6>
                    <p style="margin:0;padding:0;color:#999;font-style: italic;">
                    {{product['props'] ? product['props']['composition'] : ''}}
                    </p>
                </div>
            </ng-template>
            </p-autoComplete>
    `
})
export class ProductSelectComponent {

    product:any;
    filteredProducts:any[] = [];
    products:any = [];
    disabled:boolean = false;

    @Output() selected = new EventEmitter();

    constructor(private prodService:ProductsService){}

    ngOnInit(){
        this.prodService.findAll(null).subscribe(data => this.products = data);
    }

    filterProduct(event:any) {
        this.product = {existing:false,product:{title:event.query}};
        
        let filtered : any[] = [];
        let query = event.query;

        for(let i = 0; i < this.products.length; i++) {
            let prod = this.products[i];
            if ((prod.title.toLowerCase().indexOf(query.toLowerCase()) == 0) || 
                (prod.category ==='Drug' && prod.props && prod.props.composition && prod.props.composition.toLowerCase().indexOf(query.toLowerCase()) >= 0) ) {
                filtered.push(prod);
            }
        }
        this.filteredProducts = filtered;
    }

    doneSelect(event:any){
        this.selected.emit(event);
    }

    clear(){
        this.disabled = false;
    }
}