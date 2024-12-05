import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { StockService } from "../../store/stock/stock.service";
import { Offer } from "../models/offer.model";
import { OfferService } from "../offer.service";
import { SaleHelper } from "../sale.helper";
import { SaleService } from "../sales.service";

@Component({
    selector: 'app-sale-form-items',
    templateUrl: './sale-form-items.component.html'
})
export class SaleFormItemsComponent{

  @Input() items:any;
  
  offers:Offer[] = [];
  offer:Offer = {};

  paymodes = [
    {key:'Other',value:'Other'},
    {key:'UPI',value:'UPI'},
    {key:'Transfer',value:'Transfer'}
  ]
  
  tender:number = 0;

  @Output() itemAdded = new EventEmitter();
  @Output() itemUpdated = new EventEmitter();
  @Output() itemRemoved = new EventEmitter();
  
  total:number = 0;
  newSaleItem = {id:0,price:0,qty:0,qtyready:false}

  // box:string = '';
  // boxitem:string = '';
  // balqty:string = '';

  constructor(private saleService:SaleService, 
    private helper: SaleHelper,
    private offerService:OfferService,
    private stockService:StockService){}

  selectProduct(selected:any) {
    const item = this.helper.mapStockToSaleItem(selected, true);
    this.calculateTotalWithQtyChange(item);
    this.itemAdded.emit(item);
  }

  applyDiscount(){
    this.refreshTotal(this.items);  
  }

  refreshTotal(saleItems:any){
    this.total = 0;
    saleItems.forEach((i:any) => {
      const qty = (i.box * i.pack) + i.boxbal;
      const itemtotal = this.calculateTotal(qty, i.price, i.taxpcnt);
      i['total'] = itemtotal;
      i['qtyready'] = true;
      i['unitsbal'] = i.available - i.qty;
      this.total = Math.round(this.total + itemtotal);
    });
    
    const newTotal = this.total - (this.offer.amount||0);
    this.total = newTotal > 0 ? newTotal : 0;
  }

  // applyOffer(){
  //   // console.log('applyoffer: this.total: ',this.total );
  //   this.offer = null;

  //   const lastDt = Date.parse(this.customerLastBillDate);
  //   const currentDt = Date.parse((new Date()).toISOString());
  //   const days = (currentDt - lastDt)/1000/60/60/24;

  //   //if previous bill amount or first month bill amount is greater than rs.250
  //   if(this.sale.customer && this.sale.customer.id && 
  //     this.customerTotalOrders == 1 && this.customerTotalSaleAmount >= 250 &&
  //     this.total >= 250 && days > 7) {
  //       this.offer = {code:'FIRST_NEW',amount:250};
  //   }
  // }

  selectOffer(event:any){
    const selected = event.target.value;
      const found = this.offers.find(o => o.code === selected);      
      if(found){
        this.offer = {...found}
      }
    this.refreshTotal(this.items);

    // this.recalculateTotal.emit(this.offer);
  }
    
  calculateTotal(qty:number,price:number,tax:number):number{
    let total = qty * (price||0);
    return isNaN(total) ? 0 : +total.toFixed(2);
  }

  changeItemQty(itemid:any,event:any){
    
    const item = this.items.find((i:any) => i.itemid === itemid);
    item.qty = event.target.value;  
    if(+event.target.value > +item.available){
      item.qty = item.available;
      event.target.value = item.available; //prevent entering value over max qty
    }
    else if (+event.target.value < 1){
      item.qty = 0;
      event.target.value = '';
    }

    this.refreshAvailableQty(item);
    this.calculateTotalWithQtyChange(item);

    this.itemUpdated.emit(item);
    
  }

  calculateTotalWithQtyChange(item:any){
        
    const old = item.total || 0; //previous total
    item.total = this.calculateTotal(item.qty,item.price,item.taxpcnt); //new total

    this.total = Math.round(this.total - old + item.total);

  }

  refreshAvailableQty(item:any){
    item['unitsbal'] = item.available - item.qty;
    // item['box'] = Math.trunc(item.qty / item.pack);
    // item['boxbal'] = item.qty % item.pack;
  }

  getItemsTotal(){
    let total = 0;
    this.items.forEach((i:any) => {
      if(i.itemid > 0){
        total += i.total;
      }
    });
    return total;
  }
  
      // boxInputValidate(event:any,availqty:any,pack:any,itemid:any){
      //   const input = +event.target.value;

      //   const bal = availqty % pack;
      //   const availbox = (availqty - bal)/pack;;

      //   const item = this.items.find((i:any) => i.id === itemid);
      //   item['box'] = input;
      //   let totalinputqty = (input * pack) + item.boxbal;
        
      //   if(input > availbox || totalinputqty > availqty){
      //     event.target.value = availbox;
      //     item['box'] = availbox;
      //   }

      //   let totalbalqty = availqty - totalinputqty;
      //   if(totalbalqty < 0) {
      //     item['balqty'] = 0;  
      //   }
      //   else {
      //     item['balqty'] = this.getBalQty(totalbalqty,item.pack);
      //   }
        
      //   this.onItemQtyChange(itemid, (item.box * pack) + item.boxbal);
      // }

      getBalQty(qty:number,pack:number){
        return Math.trunc(qty/pack) + '.' + (qty%pack);
      }

      // boxitemInputValidate(event:any,availqty:any,pack:any,itemid:any){
      //   const input = +event.target.value;
        
      //   const item = this.items.find((i:any) => i.id === itemid);
        
      //   let totalinputqty = (item.box * pack) + input;
      //   if(totalinputqty > availqty){
      //     totalinputqty = availqty;
      //   }
        
      //   let bal = totalinputqty % pack;
      //   let box = (totalinputqty - bal)/pack;
        
      //   if (input >= pack || totalinputqty >= availqty){
      //     item['box'] = box;
      //     item['boxbal'] = bal;
      //     event.target.value = bal;
      //   }
      //   else {
      //     item['box'] = item.box||0 ;
      //     item['boxbal'] = input;
      //   }

      //   let totalbalqty = availqty - totalinputqty;
      //   item['balqty'] = Math.trunc(totalbalqty/item.pack) + '.' + totalbalqty%item.pack;
        
      //   this.onItemQtyChange(itemid, (item.box * pack) + item.boxbal);
      // }

      removeItem(id:any){
        this.itemRemoved.emit(id);
      }

      calcTender(event:any){
        this.tender = event.target.value - this.total;
      }
}