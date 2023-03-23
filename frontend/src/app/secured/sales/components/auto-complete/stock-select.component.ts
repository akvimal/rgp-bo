import { Component, EventEmitter, Input, Output } from "@angular/core";
import { StockService } from "../../../stock/stock.service";

@Component({
    selector: 'app-stock-select',
    template: `<p-autoComplete [(ngModel)]="stock"
                    (onSelect)="selected($event)"
                    [forceSelection]="true"
                    field="title"
                    [suggestions]="filteredStock" 
                    (completeMethod)="filterStock($event)" [minLength]="2"
                    [inputStyle]="{'background-color':'#9df'}">
                    <ng-template let-stock pTemplate="item">
                        <div [ngStyle]="{maxWidth:'600px',backgroundColor:stock.available_qty == 0?'#ffff80':'inherit'}">
                            <span *ngIf="stock.available_qty == 0">Empty</span>
                            <h6 style="margin:0;padding:0;font-weight:bold">{{stock.title}} (<i class="bi bi-currency-rupee" style="padding:0"></i>{{stock.sale_price}})</h6>
                            <p style="margin:0;padding:0;color:#999;font-style: italic;">{{stock.more_props.composition}}</p>
                            <span style="margin:0;padding:0;color:blue;font-size:smaller">
                                {{stock.batch}} / {{stock.expdate|date:'MMM-yy'}} ({{stock.available_qty}})
                            </span>
                        </div>
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
            if ((st.title.toLowerCase().indexOf(query.toLowerCase()) >= 0 
                || (st.more_props && st.more_props.composition && st.more_props.composition.toLowerCase().indexOf(query.toLowerCase()) >= 0) )
                && !present ) {
                filtered.push(st);
            }
        }

        this.filteredStock = filtered;
    }

}