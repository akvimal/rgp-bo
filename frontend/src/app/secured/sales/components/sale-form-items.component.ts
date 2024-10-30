import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { StockService } from "../../stock/stock.service";
import { Offer } from "../offer.model";
import { OfferService } from "../offer.service";
import { SaleHelper } from "../sale.helper";
import { SaleService } from "../sales.service";

@Component({
    selector: 'app-sale-form-items',
    templateUrl: './sale-form-items.component.html'
})
export class SaleFormItemsComponent{

  @Input() items:any;
  // @Input() sale:any;
  // @Input() customer:any;
  
  offers:Offer[] = [];
  offer:Offer = {};

  paymodes = [
    {key:'Other',value:'Other'},
    {key:'UPI',value:'UPI'},
    {key:'Transfer',value:'Transfer'}
  ]
  
  tender:number = 0;

  @Output() itemAdded = new EventEmitter();
  @Output() itemRemoved = new EventEmitter();
  
  total:number = 0;
  // newSaleItem = {purchaseitemid:'',price:'',box:'',boxbal:''};
  newSaleItem = {id:0,price:0,qty:0,qtyready:false}
  // customerTotalOrders = 0;
  // customerTotalSaleAmount = 0;
  // customerLastBillDate:any;

  // box:string = '';
  // boxitem:string = '';
  // balqty:string = '';

  constructor(private saleService:SaleService, 
    private helper: SaleHelper,
    private offerService:OfferService,
    private stockService:StockService){}

  ngOnChanges(changes: SimpleChanges) {

    // if(changes['items']){
    //   const ids = changes['items'].currentValue.map((i:any) => i.itemid)
    //   //fetch available quantities
    //   if(ids.length > 0){
    //   this.stockService.findByItems(ids).subscribe((data:any) => {

    //     // console.log('DATA');
    //     // console.log(data);
        
    //     changes['items'].currentValue.forEach((item:any) => {
    //       if(item.product){
    //         item['title'] = item.product.title;
    //         item['edited'] = true;
    //         item['maxqty'] = +data.find((d:any)=>d['purchase_itemid']==item.itemid)['available'] + (item.status == 'Complete' ? item.qty : 0);
    //         this.refreshAvailableQty(item);
    //       }
    //       this.calculateTotalWithQtyChange(item);
    //     });
        
    //     // this.refreshTotal(changes['items'].currentValue);
        
    //     // this.recalculateTotal.emit(true);
    //   })
    // }
     
    // }

    // if(changes['customer'] && changes['customer'].currentValue){
    //   if(changes['customer'].currentValue.id){
    //     this.saleService.getSalesByCustomer(changes['customer'].currentValue.id).subscribe((data:any) => {
          
    //           this.customerTotalOrders = data.length;
    //           data.forEach((s:any) => {
    //             this.customerTotalSaleAmount += s.total;
    //           });
    //           this.customerLastBillDate = data.length == 1 && data[0].billdate;
    //         });
    //   }
    // }

    // this.offerService.state.subscribe(data => {
    //   this.offers = data.filter(d => d.available);
    // });
  }

  // ngDoCheck(){
  //   console.log(this.items);
  //   this.items.forEach((item:any) => {
  //     // if(item.product){
  //     //   item['title'] = item.product.title;
  //     //   item['edited'] = true;
  //     //   item['maxqty'] = ;
  //     //   this.refreshAvailableQty(item);
  //     // }
  //     this.calculateTotalWithQtyChange(item);
  //   });
  // }
  // selectProduct(itemid:number,selected:any) {
    selectProduct(selected:any) {
      
    const item = this.helper.mapStockToSaleItem(selected, true);
    // this.refreshAvailableQty(item);
    this.calculateTotalWithQtyChange(item);
    // this.items.push(item);
      this.itemAdded.emit(item);
    // this.recalculateTotal.emit(undefined);

    // const item = this.items.find((i:any) => i.id == itemid);

    // if(item){
    //   item.id = selected.product_id;
    //   item.itemid = selected.purchase_itemid;
    //   item.productid = selected.product_id;
    //   item.title = selected.product_title;
    //   item.batch = selected.product_batch;
    //   item.expdate = selected.product_expdate;
    //   item.qty = selected.product_pack; //default qty to pack
    //   item.maxqty = selected.available;
    //   item.pack = selected.product_pack;
    //   item.mrpcost = selected.mrp/selected.product_pack;
    //   item.price = (selected.sale_price || selected.mrp)/selected.product_pack;
    //   item.taxpcnt = selected.product_taxpcnt;
    //   // item.more_props = event.more_props;
    //   item['box'] = 0;
    //   item['boxbal'] = 0;
    //   item['qtyready'] = true;
    //   item['balqty'] = this.getBalQty(selected.available,selected.product_pack);
    //   item['unitsbal'] = selected.available_qty - item.qty;

    //   item['edited'] = true;
    //   this.refreshAvailableQty(item);
    // }        
    // this.calculateTotalWithQtyChange(item);
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
      i['unitsbal'] = i.maxqty - i.qty;
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

  // onQtyChange(itemid:any,qty:number){      
  //   const item = this.items.find((i:any) => i.itemid === itemid);
  //   item.qty = qty;
        
  //   if(qty > +item.maxqty){
  //     item.qty = item.maxqty;
  //     qty = item.maxqty; //prevent entering value over max qty
  //   }
        
  //   const old = item.total || 0; //previous total
  //   item.total = this.calculateTotal(item.qty,item.price,item.taxpcnt); //new total

  //   this.total = Math.round(this.total - old + item.total);
  //   let newTotal = this.getItemsTotal() - (this.offer?.amount || 0);
  //   if(newTotal < 0)
  //   newTotal = 0;
  //   this.total = newTotal;
    
  //   this.recalculateTotal.emit(this.offer);
  // }

  onItemQtyChange(itemid:number, qty:number){
    const item = this.items.find((i:any) => i.itemid === itemid);

    const old = item.total || 0; //previous total
    item.total = this.calculateTotal(qty,item.price,item.taxpcnt); //new total

    this.total = Math.round(this.total - old + item.total);
    let newTotal = this.getItemsTotal() - (this.offer?.amount || 0);
        
    if(newTotal < 0)
      newTotal = 0;

    this.total = Math.round(newTotal);

  }

  calculate(itemid:any,event:any){
    
    const item = this.items.find((i:any) => i.itemid === itemid);
    item.qty = event.target.value;  
    if(+event.target.value > +item.maxqty){
      item.qty = item.maxqty;
      event.target.value = item.maxqty; //prevent entering value over max qty
    }
    else if (+event.target.value < 1){
      item.qty = 0;
      event.target.value = '';
    }
    this.refreshAvailableQty(item);
    this.calculateTotalWithQtyChange(item);

    // const old = item.total || 0; //previous total
    // item.total = this.calculateTotal(item.qty,item.price,item.taxpcnt); //new total

    // this.total = Math.round(this.total - old + item.total);
    // let newTotal = this.getItemsTotal() - (this.offer?.amount || 0);
    
    // if(newTotal < 0) newTotal = 0;
    // this.total = newTotal;

    // item['unitsbal'] = item.maxqty - item.qty;
    // item['box'] = Math.trunc(item.qty / item.pack);
    // item['boxbal'] = item.qty % item.pack; 
    
    // this.recalculateTotal.emit(this.offer);
  }

  calculateTotalWithQtyChange(item:any){
    // const item = this.items.find((i:any) => i.itemid === itemid);
    // item.qty = event.target.value;
        
    // if(+event.target.value > +item.maxqty){
    //   item.qty = item.maxqty;
    //   event.target.value = item.maxqty; //prevent entering value over max qty
    // }
        
    const old = item.total || 0; //previous total
    item.total = this.calculateTotal(item.qty,item.price,item.taxpcnt); //new total

    this.total = Math.round(this.total - old + item.total);
    // let newTotal = this.getItemsTotal() - (this.offer?.amount || 0);
    
    // if(newTotal < 0) newTotal = 0;
    // this.total = newTotal;

    
  }

  refreshAvailableQty(item:any){
    item['unitsbal'] = item.maxqty - item.qty;
    item['box'] = Math.trunc(item.qty / item.pack);
    item['boxbal'] = item.qty % item.pack;
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
  
     
      boxInputValidate(event:any,availqty:any,pack:any,itemid:any){
        const input = +event.target.value;

        const bal = availqty % pack;
        const availbox = (availqty - bal)/pack;;

        const item = this.items.find((i:any) => i.id === itemid);
        item['box'] = input;
        let totalinputqty = (input * pack) + item.boxbal;
        
        if(input > availbox || totalinputqty > availqty){
          event.target.value = availbox;
          item['box'] = availbox;
        }

        let totalbalqty = availqty - totalinputqty;
        if(totalbalqty < 0) {
          item['balqty'] = 0;  
        }
        else {
          item['balqty'] = this.getBalQty(totalbalqty,item.pack);
        }
        
        this.onItemQtyChange(itemid, (item.box * pack) + item.boxbal);
      }

      getBalQty(qty:number,pack:number){
        return Math.trunc(qty/pack) + '.' + (qty%pack);
      }

      boxitemInputValidate(event:any,availqty:any,pack:any,itemid:any){
        const input = +event.target.value;
        
        const item = this.items.find((i:any) => i.id === itemid);
        
        let totalinputqty = (item.box * pack) + input;
        if(totalinputqty > availqty){
          totalinputqty = availqty;
        }
        
        let bal = totalinputqty % pack;
        let box = (totalinputqty - bal)/pack;
        
        if (input >= pack || totalinputqty >= availqty){
          item['box'] = box;
          item['boxbal'] = bal;
          event.target.value = bal;
        }
        else {
          item['box'] = item.box||0 ;
          item['boxbal'] = input;
        }

        let totalbalqty = availqty - totalinputqty;
        item['balqty'] = Math.trunc(totalbalqty/item.pack) + '.' + totalbalqty%item.pack;
        
        this.onItemQtyChange(itemid, (item.box * pack) + item.boxbal);
      }

      removeItem(id:any){
        this.itemRemoved.emit(id);
      }

      calcTender(event:any){
        this.tender = event.target.value - this.total;
      }
}