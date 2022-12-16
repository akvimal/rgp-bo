import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";

@Component({
    selector: 'app-sale-form-items',
    templateUrl: './sale-form-items.component.html'
})
export class SaleFormItemsComponent{

  @Input() items:any;
  @Input() sale:any;

  paymodes = [
    {key:'digital',value:'Digital'},
    {key:'cash',value:'Cash'}
  ]
  tender:number = 0;

  @Output() removed = new EventEmitter();
  @Output() recalculateTotal = new EventEmitter();

  total:number = 0;
  newSaleItem = {purchaseitemid:'',price:'',qty:''};

  ngOnChanges(changes: SimpleChanges) {
    if(changes['items']){
      const old = this.total || 0;
      changes['items'].currentValue.forEach((i:any) => {
        const itemtotal = this.calculateTotal(i.qty, i.price, i.taxpcnt);
        i['total'] = itemtotal;
        this.total = this.total - old + itemtotal;
      });
      this.recalculateTotal.emit(true)
    }
  }
    
  calculateTotal(qty:number,price:number,tax:number):number{
    const total = qty * ((price||0) * (1 + ((tax||0) / 100)));
    return isNaN(total) ? 0 : Math.round(+total);//.toFixed(2);
  }

  calculate(itemid:any,event:any){      
    const item = this.items.find((i:any) => i.itemid === itemid);
    item.qty = event.target.value;
        
    if(+event.target.value > +item.maxqty){
      item.qty = item.maxqty;
      event.target.value = item.maxqty; //prevent entering value over max qty
    }
        
    const old = item.total || 0; //previous total
        item.total = this.calculateTotal(item.qty,item.price,item.taxpcnt); //new total
        this.total = this.total - old + item.total;
        this.recalculateTotal.emit(true);
      }
  
      selectProduct(itemid:number,event:any) {
        const item = this.items.find((i:any) => i.id == itemid);
        if(item){
          const pi = event;
          item.title = event.title;
          item.batch = pi.batch;
          item.expdate = pi.expdate;
          item.maxqty = pi.available_qty;
          item.itemid = pi.id;
          item.price = pi.sale_price || pi.mrp_cost;
          item.taxpcnt = pi.tax_pcnt;
          item.more_props = event.more_props;
        }
      }

      removeItem(id:any){
        this.removed.emit(id);
      }

      calcTender(event:any){
        this.tender = event.target.value - this.total;
      }
}