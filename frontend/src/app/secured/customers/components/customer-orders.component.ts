import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

import { CustomersService } from "../customers.service";

@Component({
    selector: 'app-customer-orders',
    templateUrl: './customer-orders.component.html'
})
export class CustomerOrdersComponent {
    
    @Input() customer:any;
    @Output() selected:EventEmitter<any> = new EventEmitter();

    saleOrders:any[] = [];

    activeIndex: number = 0;

    periods:{yr:number,mon:number,total:number,count:number,period:string}[] = []
    
    constructor(private service:CustomersService){}

    ngOnChanges(changes:SimpleChanges){
        changes.customer.currentValue && this.service.getCustomerOrderedMonths(changes.customer.currentValue).subscribe((data:any) => {
            this.periods = data.map((d:any) => {
              return {...d,period:d.mon+'-'+(d.yr%2000)}
            });
            this.activeIndex = 0;    
            data.length > 0 && this.fetchSales(changes.customer.currentValue,data[0]['yr'], data[0]['mon'])
        });
    }

    fetchSales(cust:any,year:number,month:number){      
      this.service.getCustomerOrdersByPeriod(cust,year,month).subscribe((prevSale:any) => {
        if(prevSale.length > 0) {
          this.saleOrders = [];
          prevSale.forEach((ps:any) => {
            const items = ps.items.map((i:any) => {
              return {
                id:i.id,
                itemid:i.itemid,
                productid: i.purchaseitem.product.id,
                qty:i.qty,
                title:i.purchaseitem.product.title,
                price:i.price
              };
            });
            this.saleOrders.push({billdate:ps.billdate,billno:ps.billno,total:ps.total,items});
          });
        }
      });
    }

    copySelectedItem(){        
        const prodids:number[] = [];
        this.saleOrders.forEach((s:any) => {
            s.items && s.items.forEach((i:any) => {
                if(i.selected && !prodids.includes(i.productid)){
                prodids.push(i.productid);
                } 
            });
        });
        this.selected.emit(prodids);
    }

    toggleAll(pos:number, event:any){
        this.saleOrders[pos].items?.forEach((i:any) => {
          i.selected = event.target.checked
        });
    }
    
    selectItem(productid:any,event:any){
        this.saleOrders.forEach((s:any) => {
          s.items && s.items.forEach((i:any) => {
            if(i.productid === productid){
              i['selected'] = event.target.checked;
            }
          });
        });
    }

    viewPeriod(event:any){
      const period = this.periods[event.index];
      this.fetchSales(this.customer,period['yr'],period['mon'])
    }
    
}