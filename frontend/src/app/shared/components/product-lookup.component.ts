import { Component, EventEmitter, Output } from "@angular/core";
import { ProductsService } from "src/app/secured/products/products.service";

@Component({
    selector: 'app-product-lookup',
    template: `
        <p-autoComplete [suggestions]="filteredProducts" 
        (completeMethod)="filterProduct($event)" (onSelect)="selectProduct($event)" 
        (onBlur)="doneSelect()" [disabled]="disabled" [showEmptyMessage]="true"
        field="title">
            <ng-template let-product pTemplate="item">
            <div style="max-width:400px">
               <h6 style="margin:0;padding:0;">{{product.title}}</h6>
               <!-- <i class="bi bi-x-square"></i> -->
               <p style="color:red;font-style: italic;">{{product.props?.composition}}</p>
               </div>
            </ng-template>
        </p-autoComplete>
        <a (click)="clear()"><i class="bi bi-x-square"></i></a>
    `
})
export class ProductLookupComponent {

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

    doneSelect(){
        this.selected.emit(this.product);
    }

    selectProduct(event:any){
        this.product = {existing:true, product:event};
        this.disabled = true;
    }

    clear(){
        this.disabled = false;
    }
}