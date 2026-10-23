import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

import { CustomersService } from "../customers.service";

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

@Component({
    selector: 'app-customer-orders',
    templateUrl: './customer-orders.component.html'
})
export class CustomerOrdersComponent {

    @Input() customer:any;
    @Output() selected:EventEmitter<any> = new EventEmitter();

    saleOrders:any[] = [];
    loading = true;
    loadFailed = false;

    activeIndex: number = 0;

    /** the products ticked so far, kept while the person moves between months */
    chosen = new Set<number>();

    periods:{yr:number,mon:number,total:number,count:number,period:string}[] = []

    constructor(private service:CustomersService){}

    ngOnChanges(changes:SimpleChanges){
        if(!changes.customer || !changes.customer.currentValue) return;
        const customer = changes.customer.currentValue;
        this.loading = true;
        this.loadFailed = false;
        this.service.getCustomerOrderedMonths(customer).subscribe((data:any) => {
            this.periods = data.map((d:any) => {
              return {...d,period:`${MONTHS[d.mon-1] || d.mon} ${d.yr} (${d.count})`}
            });
            this.activeIndex = 0;
            this.saleOrders = [];
            if(data.length > 0) this.fetchSales(customer,data[0]['yr'], data[0]['mon']);
            else this.loading = false;
        }, () => { this.loading = false; this.loadFailed = true; });
    }

    fetchSales(cust:any,year:number,month:number){
      this.loading = true;
      this.service.getCustomerOrdersByPeriod(cust,year,month).subscribe((prevSale:any) => {
        // the month being looked at replaces the last one, empty or not
        this.saleOrders = (prevSale || []).map((ps:any) => {
          const items = (ps.items || []).filter((i:any) => i.purchaseitem?.product).map((i:any) => {
            return {
              id:i.id,
              itemid:i.itemid,
              productid: i.purchaseitem.product.id,
              qty:i.qty,
              title:i.purchaseitem.product.title,
              price:i.price
            };
          });
          return {billdate:ps.billdate,billno:ps.billno,total:ps.total,items};
        });
        this.loading = false;
      }, () => { this.saleOrders = []; this.loading = false; this.loadFailed = true; });
    }

    get chosenCount(): number { return this.chosen.size; }

    isChosen(productid:number): boolean { return this.chosen.has(productid); }

    /** every product of a bill is ticked */
    allChosen(sale:any): boolean {
        return !!sale.items?.length && sale.items.every((i:any) => this.chosen.has(i.productid));
    }

    copySelectedItem(){
        if(!this.chosen.size) return;
        this.selected.emit(Array.from(this.chosen));
    }

    toggleAll(pos:number, event:any){
        this.saleOrders[pos].items?.forEach((i:any) => {
          event.target.checked ? this.chosen.add(i.productid) : this.chosen.delete(i.productid);
        });
    }

    selectItem(productid:any,event:any){
        event.target.checked ? this.chosen.add(productid) : this.chosen.delete(productid);
    }

    viewPeriod(event:any){
      const period = this.periods[event.index];
      this.fetchSales(this.customer,period['yr'],period['mon'])
    }

}
