import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { StockService } from "src/app/secured/store/stock/stock.service";
import { SaleService } from "../sales.service";

@Component({
    selector: 'sale-return-adjust-form',
    templateUrl: './sale-return-adjust-form.component.html'
})
export class SaleReturnAdjustFormComponent {

    returnItem:any = {itemid:0, price:0, accept: 0, reject: {reason: '', qty: 0}, refundmode: ''};
    
    @Input() id:any;
    @Output() success = new EventEmitter();
    valid = true;
   
    constructor(private service:SaleService, private stockService:StockService){}

    ngOnChanges(changes: SimpleChanges) {
        if(changes.id.currentValue !== ''){
            this.service.findReturnItemToAdjust(this.id).subscribe((data:any) => {
                if(data && data.length == 1){
                    this.returnItem['reject']['reason'] = data[0]['comments'];
                    this.returnItem = {...this.returnItem, ...data[0], refundmode: String(data[0]['refund_mode'] || data[0]['refundmode'] || '').toUpperCase()};
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
    
    error = '';

    onSubmit(): void {
        this.error = '';
        if(!this.returnItem.refundmode){
            this.error = 'Choose how the customer is refunded.';
            return;
        }
        const input = [];

        // if(this.returnItem['accept'] > 0)
        // settle first: its checks (a named customer for credit, once only) fail before any stock is touched
        const accepted = Math.max(0, +this.returnItem.qty - (+this.returnItem.reject.qty || 0));
        input.push({itemid:this.returnItem['itemid'],qty:this.returnItem['qty'],
            price:this.returnItem['price'],reason:'Returned',status:'APPROVED'});
        if(this.returnItem['reject']['qty'] > 0)
        input.push({itemid:this.returnItem['itemid'],qty:-1*this.returnItem['reject']['qty'],
            price:this.returnItem['price'],reason:'Damaged',comments:this.returnItem['comments'],status:'APPROVED'});
    
        this.service.settleReturn({id:this.returnItem.id,status:'ADJUSTED',refundmode:this.returnItem.refundmode,acceptedqty:accepted}).subscribe(() => {
            this.stockService.adjustReturnQuantities(input).subscribe(data => {
                this.success.emit(data);
            }, () => {
                this.error = 'The refund is recorded but the stock adjustment failed. Adjust the stock by hand.';
            });
        }, (err:any) => {
            const m = err?.error?.message;
            this.error = Array.isArray(m) ? m.join(' ') : (m || 'Could not settle the return.');
        });
    }
}