import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { StockService } from "../../store/stock/stock.service";
import { SaleService } from "../sales.service";

@Component({
    selector: 'sale-return-adjust-form',
    templateUrl: './sale-return-adjust-form.component.html'
})
export class SaleReturnAdjustFormComponent {

    returnItem:any = {itemid:0, price:0, accept: 0, reject: {reason: '', qty: 0}};
    
    @Input() id:any;
    @Output() success = new EventEmitter();
    valid = true;
   
    constructor(private service:SaleService, private stockService:StockService){}

    ngOnChanges(changes: SimpleChanges) {
        if(changes.id.currentValue !== ''){
            this.service.findReturnItemToAdjust(this.id).subscribe((data:any) => {
                if(data && data.length == 1){
                    this.returnItem['reject']['reason'] = data[0]['comments'];
                    this.returnItem = {...this.returnItem, ...data[0]};
                }
            });
        }
    }

    validate(part:any, event:any){
        
        if(part == 'ACCEPT'){
            this.returnItem.reject.qty = this.returnItem.qty - event.target.value;
        }
        if(part == 'REJECT'){
            this.returnItem.accept = this.returnItem.qty - event.target.value;
        }
        
        if(event.target.value > +this.returnItem.qty){
            event.target.value = 0
        }
    }
    
    onSubmit(): void {
        const input = [];

        // if(this.returnItem['accept'] > 0)
        input.push({itemid:this.returnItem['itemid'],qty:this.returnItem['qty'],
            price:this.returnItem['price'],reason:'Returned',status:'APPROVED'});
        if(this.returnItem['reject']['qty'] > 0)
        input.push({itemid:this.returnItem['itemid'],qty:-1*this.returnItem['reject']['qty'],
            price:this.returnItem['price'],reason:'Damaged',comments:this.returnItem['comments'],status:'APPROVED'});
    
        this.stockService.adjustReturnQuantities(input).subscribe(data => {
            this.service.saveReturns([{id:this.returnItem.id,status:'ADJUSTED'}]).subscribe(adj => {
                this.success.emit(data);
            });
        });
    }
}