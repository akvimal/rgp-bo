import { Component, EventEmitter, Input, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { StockService } from "src/app/secured/store/stock/stock.service";
import { PropsService } from "../props.service";

@Component({
    selector: 'app-stock-select',
    template: `<span class="p-fluid"><p-autoComplete
                    (onSelect)="selected($event)"
                    field="''"
                    placeholder="Name / Composition"
                    [suggestions]="filteredStock" 
                    (completeMethod)="filterStock($event)" [minLength]="2"
                    [inputStyle]="{'background-color':'#9df'}">
                    <ng-template let-stock pTemplate="item">
                        <div [ngStyle]="{maxWidth:'800px',backgroundColor:stock.balance < 1?'#ffc0c0':'inherit'}">
                            <h6 style="margin:0;padding:0;font-weight:bold">{{stock.title}} (<i class="bi bi-currency-rupee" style="padding:0"></i>{{stock.sale_price||'None'}})</h6>
                            <p style="margin:0;padding:0;color:#999;font-style: italic;">
                            {{stock['more_props'] ? stock['more_props']['composition'] : ''}}
                            </p>
                            <span style="margin:0;padding:0;color:blue;">
                                {{stock.batch}} / {{stock.exp_date|date:'MMM-yy'}} ({{stock.balance}})
                            </span>
                        </div>
                    </ng-template>
                </p-autoComplete></span>`
})
export class StockSelectComponent {

    @Input() excludeItems = [];
    @Output() stockSelected = new EventEmitter();

    selectedStock: any;
    filteredStock: any[] = [];
    searchable:any[] = [];

    // props$?:Observable<any>;

    constructor(private stockService:StockService, private propsService:PropsService, private http: HttpClient){
        // this.props$ = this.propsService.props;
    }

    ngOnInit(){
        this.propsService.productProps$.subscribe(data => {
            if(data){
                data.forEach((category:any) => {
                    category['props'].forEach((prop:any) => {
                        prop['searchable'] && this.searchable.push(prop);   
                    }); 
                });
            }
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
        
        this.stockService.filterByCriteria({title:event.query, excludeItems:this.excludeItems,
            starts:true, 
            available:true,
            expired:false,
            status:'VERIFIED',
            limit:25}).subscribe((data:any) => {
            filtered = data;
           this.filteredStock = filtered;         
        });        
    }

}