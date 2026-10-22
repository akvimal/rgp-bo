import { AfterViewInit, Component, EventEmitter, Input, Output, SimpleChanges, ViewChild } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ProductsService } from "src/app/secured/products/products.service";

@Component({
    selector: 'app-product-select',
    template: `
    <span class="p-fluid">
    <div [formGroup]="formGroup">
        <p-autoComplete #ac 
        (onSelect)="doneSelect($event)" 
        formControlName="title"
        field="title"
        placeholder="Name / Composition" 
        [suggestions]="filteredProducts" 
        [minLength]="2"
        (completeMethod)="filterProduct($event)" 
        [inputStyle]="{'background-color':'#f4f7ff'}">
            <ng-template let-product pTemplate="item">
                <div>
                    <h6 style="margin:0;padding:0;font-weight:bold">{{product.title}}</h6>
                    <p style="margin:0;padding:0;color:#999;font-style: italic;">
                    {{product['props'] ? product['props']['composition'] : ''}}
                    </p>
                </div>
            </ng-template>
        </p-autoComplete>
        </div>
    </span>
    `
})
export class ProductSelectComponent implements AfterViewInit {

    @Input() reset = false;
    /** text to start with (for example the name read from an invoice); with autoSearch the matches are listed straight away */
    @Input() initial = '';
    @Input() autoSearch = false;
    @ViewChild('ac') ac:any;
    filteredProducts:any[] = [];

    formGroup = new FormGroup({
        title: new FormControl(null)
    });

    @Output() selected = new EventEmitter();

    constructor(private prodService:ProductsService){}

    ngOnChanges(changes:SimpleChanges){
        if(changes.reset && changes.reset.currentValue == true){
            this.formGroup.reset();
        }
    }

    ngAfterViewInit(){
        if(!this.initial) return;
        this.formGroup.controls['title'].setValue({ title: this.initial });          // the box shows the title of its value, so a text goes in as one
        if(this.autoSearch && this.ac){
            // the box's own search opens the list of matches when they arrive
            setTimeout(() => { this.ac.focusInput(); this.ac.search({}, this.initial); });
        }
    }

    /** more than one word: the products whose title has every word; otherwise (or when none) a title that starts with it, or a composition that has it */
    private search(query:string){
        const words = String(query || '').split(/\s+/).map(w => w.replace(/[^A-Za-z0-9.]/g, '')).filter(w => w.length >= 2).slice(0, 3);
        const byTitle = {condition:'any', criteria:[
            {property:'title',check:'startswith',value:query},
            {property:'composition', props_json:'more_props', check:'contains',value:query}]};
        const apply = (data:any) => {
            this.filteredProducts = data;
        };
        if(words.length > 1){
            this.prodService.findByCriteria({condition:'all', criteria: words.map(w => ({property:'title', check:'contains', value:w}))}).subscribe((all:any) => {
                if(all && all.length) apply(all);
                else this.prodService.findByCriteria(byTitle).subscribe((d:any) => apply(d));
            });
        } else {
            this.prodService.findByCriteria(byTitle).subscribe((d:any) => apply(d));
        }
    }

    filterProduct(event:any) {
        this.search(event.query);
    }

    doneSelect(event:any){
        this.selected.emit(event);
    }

}
