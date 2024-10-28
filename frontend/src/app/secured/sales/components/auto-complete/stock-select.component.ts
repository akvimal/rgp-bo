import { Component, EventEmitter, Input, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { StockService } from "../../../stock/stock.service";

@Component({
    selector: 'app-stock-select',
    template: `<p-autoComplete [(ngModel)]="stock"
                    (onSelect)="selected($event)"
                    [forceSelection]="true"
                    field="product_title"
                    [suggestions]="filteredStock" 
                    (completeMethod)="filterStock($event)" [minLength]="2"
                    [inputStyle]="{'background-color':'#9df'}">
                    <ng-template let-stock pTemplate="item">
                        <div [ngStyle]="{maxWidth:'600px',backgroundColor:stock.available < 1?'#ffc0c0':'inherit'}">
                            <span *ngIf="stock.available_qty < 1">Empty</span>
                            <h6 style="margin:0;padding:0;font-weight:bold">{{stock.product_title}} (<i class="bi bi-currency-rupee" style="padding:0"></i>{{stock.sale_price||stock.mrp}})</h6>
                            <p style="margin:0;padding:0;color:#999;font-style: italic;">Composition</p>
                            <span style="margin:0;padding:0;color:blue;font-size:smaller">
                                {{stock.product_batch}} / {{stock.product_expdate|date:'MMM-yy'}} ({{stock.available}})
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
    searchable:any[] = []

    constructor(private stockService:StockService, private http: HttpClient){}

    ngOnInit(){
        this.http.get("/assets/props.json").subscribe((data:any) => {
            data.forEach((category:any) => {
                category['props'].forEach((prop:any) => {
                    prop['searchable'] && this.searchable.push(prop);   
                }); 
            });
        });
    }

    selected(stockitem:any){
        if(stockitem.available > 0) {
            this.stockSelected.emit(stockitem);
        }
    }

    isPropMatch(props:any,query:string){
        let match = false;
        this.searchable.forEach(data => {
            if(!match) {
                if(data['type']==='MULTI-SELECT'){
                    match = props[data.id] && props[data.id].find((e:any) => e.name.toLowerCase().startsWith(query.toLowerCase()))
                }
                else {
                    match = props[data.id] && props[data.id].toLowerCase().indexOf(query.toLowerCase()) >= 0;
                }
            }
        })
        return match;
    }

    filterStock(event:any) {
        let filtered : any[] = [];
        this.stockService.filterByCriteria(event.query).subscribe((data:any) => {
            filtered = data;
           this.filteredStock = filtered;         
        });        
    }

}