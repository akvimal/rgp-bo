import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { SaleService } from "../sales.service";

@Component({
    selector: 'sale-return-form',
    templateUrl: './sale-return-form.component.html'
})
export class SaleReturnFormComponent {

    header:any = {};
    items:[] = [];
    @Input() id:any;
    @Output() success = new EventEmitter();
    valid = true;
    total = 0;
    
   
    constructor(private service:SaleService){}

    ngOnChanges(changes: SimpleChanges) {
        if(changes.id.currentValue !== ''){
            this.service.findEligibleReturnItems(this.id).subscribe((data:any) => {
                this.header = {billno:data['billno'],orderno:data['orderno'],
                                billdate:data['billdate']};
                if(data['customer']){
                    this.header = {...this.header, customername: data['customer']['name'],
                            customermobile: data['customer']['mobile']}
                }
                
                this.items = data.items.map((i:any) => {
                    return {...i, elig: i['eligible'], qty: ''}
                });
            })  
        }
    }

    changeItem(field:any, event:any,itemid:any){
        this.total = 0;
        this.items.forEach((item:any) => {
            if(item.id === itemid){
                switch (field) {
                    case 'QTY':
                        item['qty'] = event.target.value;        
                        break;
                    case 'REASON':
                        item['reason'] = event.target.options[event.target.options.selectedIndex].value;        
                        break;
                    case 'COMMENT':
                        item['comments'] = event.target.value;        
                        break;
                    default:
                        break;
                }
            }
            this.total += (item['qty']||0) * item['price'];
            item['valid'] = item['qty'] !== '' && item['reason'];
            this.valid = true;
        });
    }
 
    onSubmit(): void {
        const returns = this.items.filter((item:any) => item.valid);
        if(returns.length == 0){
            this.valid = false;
            return;
        }
        const input = returns.map((item:any) => {
            return {
                saleitemid: item.id,
                qty: item.qty,
                status:'NEW',
                reason:item.reason,
                comments:item.comments
            }
        });
        this.service.saveReturns(input).subscribe(data => {
            this.success.emit(data);
        });
    }
}