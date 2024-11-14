import { HttpClient } from "@angular/common/http";
import { Component, SimpleChanges } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ProductUtilService } from "../../product-util.service";
import { StockService } from "../../store/stock/stock.service";
import { SaleHelper } from "../sale.helper";
import { Sale } from "../sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: 'sale-form.component.html'
})
export class SaleFormComponent {

    sale:Sale = {status:'NEW',items:[]}
    
    displayPrevSalesCopy: boolean = false;
    displaySalePropsForm: boolean = false;
    displayNewCustomer:boolean = false;
    
    salePropValues:any;

    total:number = 0;
    
    inputCustomer:boolean = true;
    saleWithCustomer:boolean = true;

    newSaleItem = {id:0,price:0,qty:0,status:'New',edited:false,qtyready:false}

    prevCustSales:Sale[] = []
    fetchCustomerPrevSales = true;

    salePropSchema:any[] = []
    saleprops:any[] = []
    form:FormGroup = new FormGroup({});

    isCash = false;
    digiamt = 0;
    cashamt = 0;
    cashbal = 0;
    paymode = 'PayTM';
    payrefno = '';

    custCustomerTypes:any[] = [
      { value: 'Walkin', label: 'Walk in' },
      // { value: 'Online', label: 'Online Search' },
      // { value: 'Banner', label: 'Banner' },
      { value: 'PaperAd', label: 'Advertisement' },
      { value: 'Referral', label: 'Referral' },
      // { value: 'Campaign', label: 'Campaign' },
      { value: 'Other', label: 'Other' },
      // { value: 'Unknown', label: 'Unknown' },
    ]

    constructor(private route: ActivatedRoute,
      private router: Router, 
      private helper: SaleHelper,
      private service: SaleService,
      private stockService: StockService,
      private prodUtilService: ProductUtilService,
      private http: HttpClient){
        this.http.get("/assets/sale-props.json").subscribe((data:any) => this.salePropSchema = data);
      }

    ngOnInit(){
      this.sale.billdate = new Date();
      //get the id from url query params
      this.route.paramMap.subscribe(params => {  
        const saleId =  params.get("id");
        saleId !== null && this.service.find(saleId).subscribe((result:any) => {
          this.service.findItemsWithAvailableQty(+saleId).subscribe((items:any) => {
            result['items'] = items.map((element:any) => {
              return {...element, edited:true, title: element.product_title, 
                taxpcnt: element.product_taxpcnt,
                mrpcost: (element.mrp/element.product_pack),
                expdate: element.product_expdate,
                unitsbal: element.available - element.product_pack,
                itemid: element.purchase_itemid
              }
            });;
            this.sale = result;
            this.recalculateTotal();
          });
        });
      });
    }

    resetCustomer(){
      this.sale.customer = null;
      this.inputCustomer = true;
    }

    customerInfoCaptured(){
      return this.sale.customer && 
      (this.sale.customer.name && this.sale.customer.name !== '') && 
      (this.sale.customer.mobile && this.sale.customer.mobile !== '');
    }

    onItemAdd(item:any){
      this.sale.items?.push(item);
      this.recalculateTotal();
    }

    onItemUpdate(item:any){
      this.sale.items?.forEach(element => {
        element = item;
      });
      this.recalculateTotal();
    }

    recalculateTotal(){
      this.total = 0;
      let mrptotal = 0;

      this.sale.items?.filter((i:any) => i.edited).forEach((i:any) => {        
          this.total += Math.round(+i.total);
          mrptotal += +(i.mrpcost||0)*i.qty;
      });

      this.sale.total = Math.round(this.total);
      this.sale.mrptotal = Math.round(mrptotal);
      this.sale.totalitems = this.sale.items?.filter((i:any) => i.edited).length;
      this.sale.saving = this.prodUtilService.getSaving(mrptotal,Math.round(this.total));
      this.digiamt = this.total;
    }

    selectCustomer(customer:any, copySales:boolean){
      const {id,name,mobile,email,address} = customer;
      if(customer.existing){ 
        this.sale.customer = {id,name,mobile,email,address};
        copySales && this.showPrevSalesCopy();
      }
      else {
        this.sale.customer = {mobile,name:''};
      }
      this.fetchCustomerPrevSales = copySales;
      this.inputCustomer = false;
    }
  
  // doneEnterCustomer(event:any){    
  //   const inputval = event.target.value;
  //   if(inputval.length > 0){
  //     if(inputval.length !== 10) {
  //       event.target.value = inputval.substring(0,10);
  //     }
  //   } 
    
  //   this.sale.customer = {mobile:inputval};
  // }

  onItemRemoved(id:any){
    if(this.sale.items) {
      this.sale.items = [...this.sale.items].filter((i:any) => i.itemid !== id)
    }
    this.recalculateTotal();
  }

  doesProductContains(items:any, prop:string, value:any){
    const props = items.filter((i:any) => i.more_props && i.more_props[prop] === value);
    return props && props.length > 0;
  }

  saveCustomer(){
    this.submit(this.sale.status);
  }

  cancelCustomer(){
    this.saleWithCustomer = false;
    this.submit(this.sale.status);
  }

  discard(){
    this.sale.id && this.service.remove(this.sale.id).subscribe(data => {
      this.service.refreshSavedSales();
      this.router.navigate([`/secure/sales/pos`]);
    });
  }

  submit(status:any){

    this.sale.status = status;

    if(this.saleWithCustomer && !this.customerInfoCaptured()){
      this.displayNewCustomer = true;
      return;
    }
    this.displayNewCustomer = false;
    
    this.sale.items = this.sale.items?.map((item:any) => {
      switch (status) {
        case 'COMPLETE':
            item['status'] = 'Complete';
            break;
        case 'PENDING':
                item['status'] = 'Pending'
            break;
        default:
            break;
      }
      item['productid'] = item['product_id'];
      return item;
    });

    if(this.sale.status == 'COMPLETE'){
      if(this.digiamt > 0) {
        this.sale['digimethod']=this.paymode;
        this.sale['digirefno']=this.payrefno;
        this.sale['digiamt']=this.digiamt;
      }
      if(this.cashamt > 0) {
        this.sale['cashamt'] = this.cashamt > this.total ? this.total : this.cashamt;
      }
    }
    
    this.service.save({...this.sale, status}).subscribe((data:any) => {
      this.salePropValues = null;
      this.redirectAfterSubmit(data.status, data.id);
      this.service.refreshSavedSales();
    });
  }

  redirectAfterSubmit(status:string,id:number){
    if(status === 'COMPLETE')
      this.router.navigateByUrl(`/secure/sales/view/${id}`); 
    else 
      this.router.navigate([`/secure/sales/pos/edit`,id]);
  }

  updateCustomer(attr:string,event:any){
    if(!this.sale.customer){
      this.sale.customer = {}
    }

    // if(attr === 'srctype'){
    //   this.sale.customer.srctype = event.target.value;
    // } else if(attr === 'srcdesc'){
    //   this.sale.customer.srcdesc = event.target.value;
    // } else if(attr === 'address'){
    //   this.sale.customer.address = event.target.value
    // } else if(attr === 'area'){
    //   this.sale.customer.area = event.target.value
    // } else if(attr === 'locality'){
    //   this.sale.customer.locality = event.target.value
    // } else 
    if(attr === 'email'){
      this.sale.customer.email = event.target.value
    } else if(attr === 'name'){
      this.sale.customer.name = this.capitalize(event.target.value)
    }else if(attr === 'mobile'){
      this.sale.customer.mobile = event.target.value
    }
  }

  capitalize(word:string){
      const lower = word.toLowerCase();
      return word.charAt(0).toUpperCase() + lower.slice(1);
  }

  cancel(){
    this.router.navigateByUrl(`/secure/sales`); 
  }

  showPrevSalesCopy() {

    // this is to pre select the sale items are already in cart
    // const addedItemsToSale = this.sale.items?.map((i:any) => i.itemid)
    
    this.fetchCustomerPrevSales && this.service.getSalesByCustomer(this.sale.customer.id).subscribe((prevSale:any) => {
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

        this.displayPrevSalesCopy = true;
      }
    });
    
  }

  // copyCustomerInfo(event:any) {  
  //   this.form.controls['props'].get('ptntname')?.setValue(event.target.checked ? this.sale.customer.name : '');
  //   this.form.controls['props'].get('ptntmobile')?.setValue(event.target.checked ? this.sale.customer.mobile : '');
  //   this.form.controls['props'].get('ptntaddr')?.setValue(event.target.checked ? this.sale.customer.address : '');
  // }

  selectItem(productid:any,event:any){
    this.prevCustSales.forEach((s:Sale) => {
      s.items && s.items.forEach((i:any) => {
        if(i.productid === productid){
          i['selected'] = event.target.checked;
        }
      })
    })
  }

  copyActionEnabled(){
    return this.prevCustSales.filter((s:Sale) => {
      return s.items && s.items.filter((i:any) => i.selected).length > 0
    }).length > 0
  }

  onSubmitSaleProps(){
    this.displaySalePropsForm = false;
    this.salePropValues = this.form.controls['props'].value;
    this.submit('COMPLETE');
  }

  copySelectedItem(){
    const arr = this.sale.items?.map(i => {return i;});
    //get products selected
    const prodids:number[] = []
     this.prevCustSales.forEach((s:Sale) => {
      s.items && s.items.forEach((i:any) => {
        if(i.selected && !prodids.includes(i.productid)){
          prodids.push(i.productid);
        } 
      })
     });

     this.stockService.findByProducts(prodids).subscribe((items:any) => {
      
      items.forEach((selected:any) => {
        arr?.push({...this.helper.mapStockToSaleItem(selected,true)});
      });

      this.recalculateTotal();
     });

    //get the stock of products selected and update items
    this.sale.items = arr;
    this.displayPrevSalesCopy = false;
  }

  toggleAll(pos:number, event:any){
    this.prevCustSales[pos].items?.forEach(i => {
      i.selected = event.target.checked
    });
  }

  calcCashBal(mode:string,event:any){
    const bal = Math.round(this.total) - (+this.cashamt + +this.digiamt);
    this.cashbal = bal < 0 ? (-1 * bal) : 0; 
  }

  isCashPartial(){
    return +this.cashamt < +this.total ? true : false;
  }

  changeToCash(event:any){
    if(event.target.checked){
      this.cashamt = this.total;
      this.digiamt = 0;
    }
    else {
      this.cashamt = 0;
      this.cashbal = 0;
      this.digiamt = this.total;
    }
  }

  isCompleteReady(){
    const amt = +this.digiamt + +this.cashamt
    return this.total > 0 && (amt >= this.total);
  }
}