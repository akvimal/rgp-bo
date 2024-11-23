import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { DateUtilService } from "../../date-util.service";
import { ProductUtilService } from "../../product-util.service";
import { StockService } from "../../store/stock/stock.service";
import { SaleHelper } from "../sale.helper";
import { Sale } from "../models/sale.model";
import { SaleService } from "../sales.service";

@Component({
    templateUrl: 'sale-form.component.html'
})
export class SaleFormComponent {

    sale:Sale = {status:'NEW',items:[],digimethod:'PayTM',customer:{existing:false,mobile:''}}
    
    displayPrevSalesCopy: boolean = false;
    displaySalePropsForm: boolean = false;
    // displayNewCustomer:boolean = false;
    
    salePropValues:any;

    total:number = 0;
    payment:any = {};
    paymentValid=false;
    
    // saleWithCustomer:boolean = true;

    prevCustSales:Sale[] = []
    fetchCustomerPrevSales = true;

    salePropSchema:any[] = []
    saleprops:any[] = []
    form:FormGroup = new FormGroup({});

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
      private dateService: DateUtilService,
      private prodUtilService: ProductUtilService,
      private http: HttpClient){
        this.http.get("/assets/sale-props.json").subscribe((data:any) => this.salePropSchema = data);
      }

    ngOnInit(){
      this.sale.billdate = new Date();
      this.sale['ordertype'] = 'Walk-in';
      this.sale['deliverytype'] = 'Counter';
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
            
            this.payment['cashamt'] = this.sale['cashamt'];
            this.payment['digimode'] = this.sale['digimethod'];
            this.payment['digiamt'] = this.sale['digiamt'];
            this.payment['digirefno'] = this.sale['digirefno'];

            this.recalculateTotal()
          });
        });
      });
    }

    resetCustomer(){
      this.sale.customer['existing'] = false;
      this.sale.customer['mobile'] = '';
      this.sale.customer['name'] = '';
      this.sale.customer['email'] = '';
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
    }

    selectCustomer(customer:any, copySales:boolean){
      this.sale.customer = customer;
      this.displayPrevSalesCopy = copySales; 
    }

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

  // continueSubmit(){
  //   this.saleWithCustomer = false;
  //   this.submit(this.sale.status);
  // }

  discard(){
    this.sale.id && this.service.remove(this.sale.id).subscribe(data => {
      this.service.refreshSavedSales();
      this.router.navigate([`/secure/sales/pos`]);
    });
  }

  submit(status:any){

    this.sale.status = status;
    
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
        this.sale['cashamt'] = this.payment.cashamt;
        this.sale['digiamt'] = this.payment.digiamt;
        this.sale['digimethod'] = this.payment.digimode;
        this.sale['digirefno'] = this.payment.digirefno;
    }

    const obj = this.sale;
    if(this.sale.customer.mobile === '')
    obj['customer'] = null;
    
    this.service.save({...obj, billdate: this.dateService.getFormatDate(new Date()), status}).subscribe((data:any) => {
      this.salePropValues = null;
      this.redirectAfterSubmit(data.status, data.id);
      this.service.refreshSavedSales();
    });
  }

  redirectAfterSubmit(status:string,id:number){
    console.log(status);
    
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

  paymentinfo(event:any){
    this.payment = event;
  }

  showPrevSalesCopy() {
    this.displayPrevSalesCopy = true;
  }

  captureCustomerInfo(event:any){
    this.sale.customer = event;
  }
  // copyCustomerInfo(event:any) {  
  //   this.form.controls['props'].get('ptntname')?.setValue(event.target.checked ? this.sale.customer.name : '');
  //   this.form.controls['props'].get('ptntmobile')?.setValue(event.target.checked ? this.sale.customer.mobile : '');
  //   this.form.controls['props'].get('ptntaddr')?.setValue(event.target.checked ? this.sale.customer.address : '');
  // }

  productsFromHistory(event:any){
    const arr = this.sale.items?.map(i => {return i;});
    this.stockService.findByProducts(event).subscribe((items:any) => {      
      items.forEach((selected:any) => {
        arr?.push({...this.helper.mapStockToSaleItem(selected,true)});
      });
      this.recalculateTotal(); 
    }); 
    this.sale.items = arr;
     this.displayPrevSalesCopy = false;
  }

  onSubmitSaleProps(){
    this.displaySalePropsForm = false;
    this.salePropValues = this.form.controls['props'].value;
    this.submit('COMPLETE');
  }

  isCompleteReady(){
    return this.payment && this.payment['valid'];
  }
}