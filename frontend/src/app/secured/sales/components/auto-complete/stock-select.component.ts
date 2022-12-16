import { Component, EventEmitter, Input, Output } from "@angular/core";
import { StockService } from "../../../purchases/stock/stock.service";

@Component({
    selector: 'app-stock-select',
    template: `<p-autoComplete [(ngModel)]="stock" [showEmptyMessage]="true" 
                    (onSelect)="selected($event)"
                    field="title"
                    [suggestions]="filteredStock" 
                    (completeMethod)="filterStock($event)" [minLength]="2">
                    <ng-template let-stock pTemplate="item">
                        <h6 style="margin:0;padding:0;font-weight:bold">{{stock.title}}</h6>
                        <p style="margin:0;padding:0;color:#666">{{stock.more_props.composition}}</p>
                        <span style="margin:0;padding:0;font-size:smaller;color:#999">
                        {{stock.batch}} / {{stock.expdate|date:'MMM-yy'}} ({{stock.available_qty}})
                        </span>
                    </ng-template>
                </p-autoComplete>`
})
export class StockSelectComponent {

    @Input() item:any;
    @Input() itemsSelected: any[] = [];
    @Output() stockSelected = new EventEmitter();

    stock:any;
    items:any = [];
    selectedStock: any;
    filteredStock: any[] = [];

    constructor(private stockService:StockService){}

    ngOnInit(){
        this.stockService.findAll().subscribe((data:any) => {
            this.items = data;
            this.stock = data.find((pi:any) => this.item.itemid !== '' && pi.id === this.item.itemid);            
        });
    }

    selected(event:any){
        this.stockSelected.emit(event);
    }

    filterStock(event:any) {
        
        let filtered : any[] = [];
        let query = event.query;    

        for(let i = 0; i < this.items.length; i++) {
            let st = this.items[i];
            const present = this.itemsSelected.find(i => i.itemid === st.id);
            if ((st.title.toLowerCase().indexOf(query.toLowerCase()) == 0 
                || (st.more_props && st.more_props.composition.toLowerCase().indexOf(query.toLowerCase()) >= 0) )
                && !present 
                && st.available_qty != '0') {
                filtered.push(st);
            }
        }

        this.filteredStock = filtered;
    }

}