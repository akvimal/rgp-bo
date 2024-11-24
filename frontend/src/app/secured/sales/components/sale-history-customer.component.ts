import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

import { Sale } from "../models/sale.model";
import { SaleService } from "../sales.service";

@Component({
    selector: 'app-sale-history-customer',
    templateUrl: 'sale-history-customer.component.html'
})
export class SaleHistoryCustomerComponent {

    @Input() customerid:number = 0;
    @Output() sold:EventEmitter<any> = new EventEmitter();
    activeIndex: number = 0;
    periods:{yr:number,mon:number,total:number,count:number,period:string}[] = []
    prevCustSales:Sale[] = []

    constructor(private service:SaleService){}

    ngOnChanges(changes:SimpleChanges){
        changes.customerid.currentValue && this.service.getSalesMonthByCustomer(changes.customerid.currentValue).subscribe((data:any) => {
            this.periods = data.map((d:any) => {
              return {...d,period:d.mon+'-'+(d.yr%2000)}
            });
            this.activeIndex = 0;    
            data.length > 0 && this.fetchSales(changes.customerid.currentValue,data[0]['yr'], data[0]['mon'])
        });
    }

    fetchSales(custid:number,year:number,month:number){
      this.service.getCustomerMonthlySales(custid,year,month).subscribe((prevSale:any) => {
        if(prevSale.length > 0) {
          this.prevCustSales = [];
          prevSale.forEach((ps:any) => {
            const items = ps.items.map((i:any) => {
              return {
                id:i.id,
                itemid:i.itemid,
                productid: i.purchaseitem.product.id,
                qty:i.qty,
                title:i.purchaseitem.product.title
              };
            });
            this.prevCustSales.push({billdate:ps.billdate,total:ps.total,items});
          });
        }
      });
    }

    copySelectedItem(){        
        const prodids:number[] = [];
        this.prevCustSales.forEach((s:Sale) => {
            s.items && s.items.forEach((i:any) => {
                if(i.selected && !prodids.includes(i.productid)){
                prodids.push(i.productid);
                } 
            });
        });
        this.sold.emit(prodids);
    }

    toggleAll(pos:number, event:any){
        this.prevCustSales[pos].items?.forEach(i => {
          i.selected = event.target.checked
        });
    }
    
    selectItem(productid:any,event:any){
        this.prevCustSales.forEach((s:Sale) => {
          s.items && s.items.forEach((i:any) => {
            if(i.productid === productid){
              i['selected'] = event.target.checked;
            }
          });
        });
    }

    viewPeriod(event:any){
      const period = this.periods[event.index];
      this.fetchSales(this.customerid,period['yr'],period['mon'])
    }
    
}