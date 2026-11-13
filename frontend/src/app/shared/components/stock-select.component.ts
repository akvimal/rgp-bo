import { Component, EventEmitter, Input, Output } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { StockService } from "src/app/secured/store/stock/stock.service";
import { PropsService } from "../props.service";
import { StoreContextService } from "src/app/@core/store-context.service";

@Component({
    selector: 'app-stock-select',
    template: `<span class="p-fluid" (input)="typed.emit($any($event.target).value || '')"><p-autoComplete
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
                                <span class="text-nowrap" *ngIf="!hasPrice(stock)" data-testid="stock-no-price"><span class="badge bg-secondary" title="No sale price is set for this product, so it cannot be added to a bill">No price</span></span>
                                <span class="text-nowrap" *ngIf="hasPrice(stock)" data-testid="stock-option-price">&#8377;{{listPrice(stock)}}
                                    <span class="badge bg-warning text-dark ms-1" *ngIf="isCapped(stock)" title="The stored price is above the MRP once GST is added, so the bill charges the MRP" data-testid="stock-option-capped">MRP cap</span></span>
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
    /** what has been typed in the box, so a screen can offer to look it up elsewhere (for example the brand dictionary) */
    @Output() typed = new EventEmitter<string>();

    selectedStock: any;
    filteredStock: any[] = [];
    searchable:any[] = [];

    // props$?:Observable<any>;

    constructor(private stockService:StockService, private propsService:PropsService, private http: HttpClient, private storeContext:StoreContextService){
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

    /** the unit price before GST the bill will charge: the stored price, never above the ceiling (the MRP less GST) the server sends; the same as the sale line's rate */
    private unitPrice(stock:any): number {
        const pack = +stock.pack > 0 ? +stock.pack : 1;
        return (+stock.sale_price || 0) / pack;
    }
    isCapped(stock:any): boolean {
        const ceiling = +stock.price_ceiling;
        return ceiling > 0 && this.unitPrice(stock) > ceiling;
    }
    listPrice(stock:any): string | null {
        if (!(+stock.sale_price > 0)) { return null; }
        const ceiling = +stock.price_ceiling;
        const p = this.isCapped(stock) ? ceiling : this.unitPrice(stock);
        return p.toFixed(2);
    }

    hasPrice(stock:any): boolean {
        return +stock.sale_price > 0;
    }

    selected(stockitem:any){
        // a product with no sale price is shown but never added to the bill
        if (!this.hasPrice(stockitem)) { return; }
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
        this.typed.emit(String(event.query || '').trim());
        
        // scoped to the store being billed from, so "left" matches what the save check allows
        this.stockService.filterByCriteria({title:event.query, excludeItems:this.excludeItems,
            storeid:this.storeContext.selectedStoreId,
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