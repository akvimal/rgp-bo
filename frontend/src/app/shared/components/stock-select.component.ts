import { Component, EventEmitter, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { StockService } from "src/app/secured/store/stock/stock.service";

@Component({
    selector: 'app-stock-select',
    template: `<p-autoComplete
                    (onSelect)="selected($event)"
                    field="''"
                    placeholder="Name / Composition"
                    [suggestions]="filteredStock" 
                    (completeMethod)="filterStock($event)" [minLength]="2"
                    [inputStyle]="{'background-color':'#9df'}">
                    <ng-template let-stock pTemplate="item">
                        <div [ngStyle]="{maxWidth:'800px',backgroundColor:stock.available < 1?'#ffc0c0':'inherit'}">
                            <h6 style="margin:0;padding:0;font-weight:bold">{{stock.product_title}} (<i class="bi bi-currency-rupee" style="padding:0"></i>{{stock.sale_price||stock.mrp}})</h6>
                            <p style="margin:0;padding:0;color:#999;font-style: italic;">
                            {{stock['more_props'] ? stock['more_props']['composition'] : ''}}
                            </p>
                            <span style="margin:0;padding:0;color:blue;">
                                {{stock.product_batch}} / {{stock.product_expdate|date:'MMM-yy'}} ({{stock.available}})
                            </span>
                        </div>
                    </ng-template>
                </p-autoComplete>`

})
export class StockSelectComponent {

    @Output() stockSelected = new EventEmitter();

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
        this.stockSelected.emit(stockitem);
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
        this.stockService.filterByCriteria(event.query,true,false,false,'VERIFIED',25).subscribe((data:any) => {
            filtered = data;
           this.filteredStock = filtered;         
        });        
    }

}