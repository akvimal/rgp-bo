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
                    [suggestions]="filteredStock" appendTo="body" scrollHeight="24rem" panelStyleClass="stock-select-panel" [autoHighlight]="true"
                    (completeMethod)="filterStock($event)" [minLength]="2"
                    [inputStyle]="{'background-color':'#f4f7ff'}">
                    <ng-template let-stock pTemplate="item">
                        <div [ngStyle]="{backgroundColor:stock.balance < 1?'#ffc0c0':'inherit'}" data-testid="stock-option">
                            <div class="d-flex justify-content-between align-items-baseline gap-3">
                                <span class="fw-bold text-truncate">{{stock.title}}</span>
                                <span class="text-nowrap">&#8377;{{stock.sale_price||'None'}}</span>
                            </div>
                            <div class="d-flex justify-content-between align-items-baseline gap-3 small">
                                <span class="text-muted fst-italic text-truncate">{{stock['more_props'] ? stock['more_props']['composition'] : ''}}</span>
                                <span class="text-primary text-nowrap">{{stock.batch}} / {{stock.exp_date|date:'MMM-yy'}}
                                    <span class="badge bg-success ms-1" *ngIf="stock.sellfirst" title="This batch expires first: sell it first">sell first</span>
                                    <i class="bi bi-exclamation-octagon-fill text-danger ms-1" *ngIf="stock.balance < 1" title="Out of stock" aria-label="Out of stock" data-testid="stock-out"></i></span>
                            </div>
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

    /** where a product has several batches in the list, the one that expires first is the one to sell first */
    private markSellFirst(rows: any[]): any[] {
        const earliest = new Map<any, any>();
        const count = new Map<any, number>();
        rows.forEach((r: any) => {
            count.set(r.id, (count.get(r.id) || 0) + 1);
            if (!r.exp_date) return;
            const best = earliest.get(r.id);
            if (!best || String(r.exp_date) < String(best.exp_date)) earliest.set(r.id, r);
        });
        rows.forEach((r: any) => r.sellfirst = (count.get(r.id) || 0) > 1 && earliest.get(r.id) === r);
        return rows;
    }

    filterStock(event:any) {
        let filtered : any[] = [];
        
        this.stockService.filterByCriteria({title:event.query, excludeItems:this.excludeItems,
            starts:true, 
            available:true,
            expired:false,
            status:'VERIFIED',
            limit:25}).subscribe((data:any) => {
            filtered = this.markSellFirst(data || []);
           this.filteredStock = filtered;         
        });        
    }

}