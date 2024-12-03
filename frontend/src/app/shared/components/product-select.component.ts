import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ProductsService } from "src/app/secured/products/products.service";

@Component({
    selector: 'app-product-select',
    template: `
    <span class="p-fluid">
    <form [formGroup]="formGroup">
        <p-autoComplete 
        (onSelect)="doneSelect($event)" 
        formControlName="title"
        field="title"
        placeholder="Name / Composition" 
        [suggestions]="filteredProducts" 
        [minLength]="2"
        (completeMethod)="filterProduct($event)" 
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
        </form>
    </span>
    `
})
export class ProductSelectComponent {

    @Input() reset = false;
    filteredProducts:any[] = [];

    formGroup = new FormGroup({
        title: new FormControl(null)
    });

    @Output() selected = new EventEmitter();

    constructor(private prodService:ProductsService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.reset.currentValue == true){
            this.formGroup.reset();
        }
    }

    filterProduct(event:any) {
        let query = event.query;
        let criteria = {condition:'any', criteria:[
            {property:'title',check:'startswith',value:query},
            {property:'composition', props_json:'more_props', check:'contains',value:query}]};

        this.prodService.findByCriteria(criteria).subscribe((data:any) => {
            this.filteredProducts = data;
        });
    }

    doneSelect(event:any){
        this.selected.emit(event);
    }

}