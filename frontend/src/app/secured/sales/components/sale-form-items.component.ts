import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { SaleService } from "../sales.service";

@Component({
    selector: 'app-sale-form-items',
    templateUrl: './sale-form-items.component.html'
})
export class SaleFormItemsComponent{

  @Input() items:any;
  @Input() sale:any;
  @Input() customer:any;
  @Output() offers = new EventEmitter()
  offer:any;

  paymodes = [
    {key:'digital',value:'Digital'},
    {key:'cash',value:'Cash'}
  ]
  tender:number = 0;

  @Output() removed = new EventEmitter();
  @Output() recalculateTotal = new EventEmitter();

  total:number = 0;
  newSaleItem = {purchaseitemid:'',price:'',qty:''};

  customerTotalOrders = 0;
  customerTotalSaleAmount = 0;

  constructor(private saleService:SaleService){}

  ngOnChanges(changes: SimpleChanges) {
    this.total = 0;
    console.log('changes:',changes);
    
    if(changes['items']){
      changes['items'].currentValue.forEach((i:any) => {
        const itemtotal = this.calculateTotal(i.qty, i.price, i.taxpcnt);
        i['total'] = itemtotal;
        this.total = Math.round(this.total + itemtotal);
      });
      
      this.recalculateTotal.emit(true)
    }
    if(changes['customer'] && changes['customer'].currentValue){
      if(changes['customer'].currentValue.id){
        this.saleService.getSalesByCustomer(changes['customer'].currentValue.id).subscribe((data:any) => {
              console.log('customer sale: ',data);
              this.customerTotalOrders = data.length;
              data.forEach((s:any) => {
                this.customerTotalSaleAmount += s.total;
              });
            })
      }
    }
  }

  applyOffer(){
    // console.log('applyoffer: this.total: ',this.total );
    this.offer = null;
    //if previous bill amount or first month bill amount is greater than rs.250
    if(this.sale.customer && this.sale.customer.id && 
      this.customerTotalOrders == 1 && this.customerTotalSaleAmount >= 250 &&
      this.total >= 250) {
        this.offer = {code:'FIRST_NEW',amount:250};
    }
  }
    
  calculateTotal(qty:number,price:number,tax:number):number{
    let total = qty * ((price||0) * (1 + ((tax||0) / 100)));
    return isNaN(total) ? 0 : +total.toFixed(2);
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

    this.total = Math.round(this.total - old + item.total);

    this.applyOffer();
      
    this.total = +( (this.getItemsTotal() - (this.offer?.amount || 0)).toFixed(2));

    this.recalculateTotal.emit(this.offer);
  }

  getItemsTotal(){
    console.log('>>>>>>');
    let total = 0;
    console.log(this.items);
    this.items.forEach((i:any) => {
      if(i.itemid !== ''){
        total += i.total
      }
    })
    return total;
  }
  
      selectProduct(itemid:number,event:any) {
        const item = this.items.find((i:any) => i.id == itemid);
        if(item){
          console.log('event: ',event);
          
          const pi = event;
          item.title = event.title;
          item.batch = pi.batch;
          item.expdate = pi.expdate;
          item.maxqty = pi.available_qty;
          item.itemid = pi.id;
          item.mrp_cost = pi.mrp_cost;
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